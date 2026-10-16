export type ReturnPathPolicy = (path: string, search: string) => boolean;
export type ReturnPathResolver = (raw: string | null, fallback: string) => string;

const unsafe = (value: string) =>
  value.includes('\\') || Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

/** Each resolver owns one injected policy and trusted default destination. */
export function createReturnPathResolver(policy: ReturnPathPolicy, defaultPath: string): ReturnPathResolver {
  function accepted(raw: string): boolean {
    if (!raw.startsWith('/') || raw.startsWith('//') || unsafe(raw)) return false;
    try {
      if (unsafe(decodeURIComponent(raw))) return false;
      const url = new URL(raw, 'https://niubu.invalid');
      const rawPath = raw.split(/[?#]/, 1)[0];
      // Never turn an encoded identity or dot segment into a different registered object.
      if (
        url.origin !== 'https://niubu.invalid' ||
        rawPath !== url.pathname ||
        rawPath.includes('%') ||
        rawPath.includes('//')
      )
        return false;
      return policy(rawPath, url.search);
    } catch {
      return false;
    }
  }
  return (raw, fallback) => {
    if (raw && accepted(raw)) return raw;
    return accepted(fallback) ? fallback : defaultPath;
  };
}
