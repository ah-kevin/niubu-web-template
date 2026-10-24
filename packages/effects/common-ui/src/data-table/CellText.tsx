export type CellTextProps = {
  value: string | number | boolean | null | undefined;
  detail?: string;
  emptyText?: string;
};

export function CellText({ value, detail, emptyText = '—' }: CellTextProps) {
  const text = value == null || value === '' ? emptyText : String(value);
  return (
    <span className="block min-w-0 max-w-full truncate" title={detail ?? text}>
      {text}
    </span>
  );
}
