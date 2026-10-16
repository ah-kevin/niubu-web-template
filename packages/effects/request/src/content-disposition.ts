const token = /^[!#$%&'*+.^_`|~\da-z-]+$/i;

function safeFilename(value: string): string | undefined {
  const cleaned = Array.from(value, character => {
    const code = character.codePointAt(0)!;
    return code < 32 ||
      (code >= 127 && code <= 159) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
      ? ''
      : character;
  }).join('');
  const name = cleaned
    .split(/[/\\]/)
    .at(-1)!
    .replace(/[<>:"|?*]/g, '')
    .trim();
  return name && name !== '.' && name !== '..' ? name : undefined;
}

/** Parse quoted strings before looking at separators; duplicate parameters are unusable. */
export function parseContentDispositionFilename(header: string | null, fallbackName = 'download'): string {
  const fallback = safeFilename(fallbackName) ?? 'download';
  if (!header) return fallback;
  let cursor = header.indexOf(';');
  if (cursor < 0 || !token.test(header.slice(0, cursor).trim())) return fallback;
  const parameters = new Map<string, { value: string; quoted: boolean } | undefined>();
  while (cursor < header.length) {
    cursor++;
    while (header[cursor] === ' ' || header[cursor] === '\t') cursor++;
    const start = cursor;
    while (cursor < header.length && !['=', ';', ' ', '\t'].includes(header[cursor])) cursor++;
    const key = header.slice(start, cursor).toLowerCase();
    while (header[cursor] === ' ' || header[cursor] === '\t') cursor++;
    const duplicate = parameters.has(key);
    let valid = token.test(key) && header[cursor] === '=';
    let quoted = false;
    let value = '';
    if (valid) {
      cursor++;
      while (header[cursor] === ' ' || header[cursor] === '\t') cursor++;
      quoted = header[cursor] === '"';
      if (quoted) {
        cursor++;
        let closed = false;
        while (cursor < header.length) {
          const character = header[cursor++];
          if (character === '"') {
            closed = true;
            break;
          }
          if (character === '\\') {
            if (cursor >= header.length) break;
            value += header[cursor++];
          } else value += character;
        }
        valid = closed;
        while (header[cursor] === ' ' || header[cursor] === '\t') cursor++;
        if (cursor < header.length && header[cursor] !== ';') valid = false;
      } else {
        const valueStart = cursor;
        while (cursor < header.length && header[cursor] !== ';') cursor++;
        value = header.slice(valueStart, cursor).trim();
        valid = token.test(value);
      }
    }
    parameters.set(key, valid && !duplicate ? { value, quoted } : undefined);
    while (cursor < header.length && header[cursor] !== ';') cursor++;
  }
  const extended = parameters.get('filename*');
  if (extended && !extended.quoted) {
    const match = /^utf-8'[a-z\d-]*'((?:[a-z\d!#$&+.^_`|~-]|%[a-f\d]{2})*)$/i.exec(extended.value);
    if (match) {
      try {
        const filename = safeFilename(decodeURIComponent(match[1]));
        if (filename) return filename;
      } catch {
        /* Invalid UTF-8 falls back to the ordinary parameter. */
      }
    }
  }
  const ordinary = parameters.get('filename');
  return (ordinary && safeFilename(ordinary.value)) || fallback;
}
