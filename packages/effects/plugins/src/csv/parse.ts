import Papa from 'papaparse';

export type CsvError = Readonly<{ code: string; message: string; row?: number }>;
export type CsvRecords = Readonly<{
  headers: readonly string[];
  records: readonly (readonly string[])[];
  errors: readonly CsvError[];
}>;
export type CsvRows = Readonly<{ rows: readonly Record<string, string>[]; errors: readonly string[] }>;

/** Parse original cells once; domain headers and constraints belong to consumers. */
export function parseCsvRecords(text: string): CsvRecords {
  if (text.length === 0 || text === '\uFEFF') return { headers: [], records: [], errors: [] };
  const result = Papa.parse<string[]>(text, {
    header: false,
    delimiter: ',',
    dynamicTyping: false,
    skipEmptyLines: false,
    fastMode: false,
    download: false,
    worker: false,
  });
  // Exactly one parser-generated final empty record represents a terminating newline.
  if (/\r?\n$|\r$/.test(text) && result.data.at(-1)?.length === 1 && result.data.at(-1)?.[0] === '') result.data.pop();
  return {
    headers: result.data[0] ?? [],
    records: result.data.slice(1),
    errors: result.errors.map(({ code, message, row }) => ({ code, message, ...(row === undefined ? {} : { row }) })),
  };
}

export function parseCsv(text: string): CsvRows {
  const { headers, records, errors } = parseCsvRecords(text);
  return {
    rows: records.map(record => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))),
    errors: errors.map(error => error.message),
  };
}
