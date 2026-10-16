import type { ScopeRef } from './context';

export type EntityRef = Readonly<{ kind: string; id: string; scope: ScopeRef }>;

export type RecordSummary = Readonly<{
  ref: EntityRef;
  title: string;
  status: string;
  occurredAt: string | null;
}>;

export type Measure = Readonly<{
  value: number | null;
  unit: string;
  quality: 'known' | 'missing' | 'unknown';
}>;

export type SeriesPoint = Readonly<{ date: string; measure: Measure }>;
export type RelatedLink = Readonly<{ label: string; target: EntityRef | null }>;

export type RecordDetail = Readonly<{
  summary: RecordSummary;
  related: readonly RelatedLink[];
  history: readonly RecordSummary[];
}>;
