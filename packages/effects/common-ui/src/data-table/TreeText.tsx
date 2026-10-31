import { Fragment } from 'react';

/** Search text remains React text, including markup-shaped input. */
export function TreeText({ text, query }: { text: string; query: string }) {
  const term = query.trim();
  if (!term) return <>{text}</>;
  const parts = [];
  let offset = 0;
  const lower = text.toLocaleLowerCase();
  const needle = term.toLocaleLowerCase();
  let index = lower.indexOf(needle);
  while (index !== -1) {
    parts.push(
      <Fragment key={index}>
        {text.slice(offset, index)}
        <mark className="rounded-[var(--radius-xs)] bg-warning-soft text-inherit">
          {text.slice(index, index + term.length)}
        </mark>
      </Fragment>,
    );
    offset = index + term.length;
    index = lower.indexOf(needle, offset);
  }
  return (
    <>
      {parts}
      {text.slice(offset)}
    </>
  );
}
