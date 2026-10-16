/** Backend selects registered pages; it never supplies a component or a page URL. */
export type AccessMode = 'frontend' | 'backend' | 'mixed';
export type MenuPresentation = Readonly<{
  title?: string;
  icon?: string;
  badge?: string | number;
  order?: number;
  hidden?: boolean;
  openInNewWindow?: boolean;
}>;
export type BackendMenuItem = Readonly<
  MenuPresentation &
    (
      | { kind: 'page'; id: string; pageId: string }
      | { kind: 'group'; id: string; title: string; children: readonly BackendMenuItem[] }
      | { kind: 'external'; id: string; title: string; href: string }
      | { kind: 'iframe'; id: string; title: string; src: string }
    )
>;
