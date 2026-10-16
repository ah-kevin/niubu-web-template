export type ResolvedTheme = 'light' | 'dark';
export type SemanticToken =
  | '--background'
  | '--foreground'
  | '--card'
  | '--primary'
  | '--primary-foreground'
  | '--primary-text'
  | '--secondary'
  | '--muted'
  | '--muted-foreground'
  | '--secondary-muted-foreground'
  | '--placeholder'
  | '--control-border'
  | '--accent'
  | '--border'
  | '--ring'
  | '--destructive'
  | '--sidebar'
  | '--sidebar-foreground'
  | '--sidebar-submenu'
  | '--sidebar-submenu-foreground'
  | '--header'
  | '--header-foreground'
  | '--nav-active'
  | '--warm'
  | '--shadow';
export type ThemeTokenMap = Readonly<Record<SemanticToken, string>>;
export interface ThemeProfile {
  readonly light: ThemeTokenMap;
  readonly dark: ThemeTokenMap;
}
export type BrandToken = '--primary' | '--primary-foreground' | '--ring' | '--accent';
export type BrandOverride = Readonly<Partial<Record<BrandToken, string>>>;

export type ThemePresetId =
  | 'default'
  | 'violet'
  | 'sakura'
  | 'lemon'
  | 'sky'
  | 'light-green'
  | 'zinc'
  | 'deep-green'
  | 'deep-blue'
  | 'orange'
  | 'rose'
  | 'neutral'
  | 'slate'
  | 'gray'
  | 'custom';
export interface ThemeAppearance {
  mode: ResolvedTheme | 'system';
  preset: ThemePresetId;
  colorPrimary: string;
  radius: 0 | 0.25 | 0.5 | 0.75 | 1;
  fontSize: number;
  semiDarkSidebar: boolean;
  semiDarkSubmenu: boolean;
  semiDarkHeader: boolean;
  colorWeak: boolean;
  grayscale: boolean;
}
