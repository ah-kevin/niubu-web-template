export type AccessMatchMode = 'all' | 'any';

/** Empty requirements impose no restriction; readiness is the caller's concern. */
export function matchesPermissions(
  granted: readonly string[],
  required: readonly string[] = [],
  mode: AccessMatchMode = 'all',
): boolean {
  return (
    required.length === 0 ||
    (mode === 'all'
      ? required.every(value => granted.includes(value))
      : required.some(value => granted.includes(value)))
  );
}
