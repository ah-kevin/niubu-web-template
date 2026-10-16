/** Display-only ordering. Unknown/duplicate IDs never create navigation or cross parent boundaries. */
export function normalizeMenuOrder(ids: readonly string[], order: readonly string[] = []): readonly string[] {
  return [...new Set([...order.filter(id => ids.includes(id)), ...ids])];
}
export function moveMenuItem(ids: readonly string[], id: string, direction: -1 | 1): readonly string[] {
  const from = ids.indexOf(id),
    to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
export function toggleMenuBranch(
  ids: readonly string[],
  id: string,
  open: boolean,
  parents: Readonly<Record<string, string | null>>,
  accordion: boolean,
): readonly string[] {
  if (!Object.hasOwn(parents, id)) return [...ids];
  const next = ids.filter(item => item !== id && (!open || !accordion || parents[item] !== parents[id]));
  return open ? [...next, id] : next;
}
