/** Pure route metadata shared by access, navigation and application projections. */
export type RouteAccess<K extends string = string> = Readonly<{
  scope: 'public' | 'account' | K;
  capability: string | null;
}>;
export type RouteMeta<K extends string = string> = Readonly<
  RouteAccess<K> & {
    id: string;
    path: string;
    titleKey: string;
    iconToken: string;
    order: number;
    navigation: boolean;
    requiredRoles?: readonly string[];
    requiredCodes?: readonly string[];
    ignoreAccess?: boolean;
    fixedTab?: boolean;
    hideInMenu?: boolean;
    hideInTabs?: boolean;
    hideInBreadcrumbs?: boolean;
    badge?: string | number;
    externalHref?: string;
    iframeSrc?: string;
    activePath?: string;
    openInNewWindow?: boolean;
  }
>;
