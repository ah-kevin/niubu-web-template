/** A replaceable read scope; this does not define tenancy or grant access. */
export type ScopeRef<K extends string = string> = Readonly<{ kind: K; id: string }>;

/** Business dates are YYYY-MM-DD; timeZone is an explicit IANA identifier. */
export type ReadContext<K extends string = string> = Readonly<{
  scope: ScopeRef<K>;
  businessDate: string;
  timeZone: string;
}>;
