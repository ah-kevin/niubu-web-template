import { alphaColor, antOutlineColor, antPalette } from './ant-palette.ts';
import { themePresetSurfaces } from './theme-presets.ts';
import type { ResolvedTheme, ThemePresetId, ThemeTokenMap } from './types.ts';

/** Vben 151d80f surfaces + Antdv Next 1.5.2 theme/default|dark/colors and util/alias. */
export function vbenControlTheme(
  id: ThemePresetId,
  mode: ResolvedTheme,
  primary: string,
  overrides: Partial<ThemeTokenMap> = {},
): ThemeTokenMap & Record<string, string> {
  const surface = { ...themePresetSurfaces[id][mode], ...overrides };
  const dark = mode === 'dark',
    textBase = surface['--foreground']!,
    card = surface['--card']!;
  // Current vben.pro emits --destructive: 348 100% 61%; preserve explicit profile overrides.
  const palette = antPalette(primary, dark),
    errorPalette = antPalette(overrides['--destructive'] ?? '#ff3860', dark);
  const hover = palette[dark ? 6 : 4]!,
    active = palette[dark ? 4 : 6]!,
    controlPrimary = palette[5]!;
  const selected = palette[dark ? 2 : 0]!,
    primaryBorder = palette[2]!,
    primaryBorderHover = palette[3]!;
  const focusPalette = overrides['--ring'] ? antPalette(overrides['--ring'], dark) : palette;
  const outline = antOutlineColor(focusPalette[dark ? 2 : 0]!, card),
    errorOutline = antOutlineColor(errorPalette[0]!, card);
  const text = alphaColor(textBase, dark ? 0.85 : 0.88),
    secondary = alphaColor(textBase, 0.65);
  const tertiary = alphaColor(textBase, 0.45),
    placeholder = alphaColor(textBase, 0.25);
  const fill = alphaColor(textBase, dark ? 0.18 : 0.15),
    fillSecondary = alphaColor(textBase, dark ? 0.12 : 0.06);
  const fillTertiary = alphaColor(textBase, dark ? 0.08 : 0.04),
    fillAlter = alphaColor(textBase, dark ? 0.04 : 0.02);
  const shadow = dark
    ? '0 6px 16px 0 rgba(255,255,255,0.016), 0 3px 6px -4px rgba(255,255,255,0.024), 0 9px 28px 8px rgba(255,255,255,0.010000000000000002)'
    : '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)';
  const defaultSurface = id === 'default' || id === 'custom';
  const popover =
    dark && defaultSurface ? '#242424' : dark && ['light-green', 'deep-green'].includes(id) ? '#171717' : card;
  const cardForeground = overrides['--foreground'] ?? (defaultSurface ? (dark ? '#f8fafc' : '#020817') : textBase);
  const secondaryForeground = dark
    ? '#fafafa'
    : ['violet', 'gray'].includes(id)
      ? '#1f2937'
      : ['sky', 'deep-blue', 'slate'].includes(id)
        ? '#0f172a'
        : ['lemon', 'orange'].includes(id)
          ? '#1c1917'
          : id === 'neutral'
            ? '#171717'
            : '#18181b';
  return {
    '--background': surface['--background']!,
    '--foreground': textBase,
    '--card': card,
    '--primary': primary,
    '--primary-foreground': '#ffffff',
    '--primary-text': primary,
    '--secondary': surface['--secondary']!,
    '--muted': surface['--muted']!,
    '--muted-foreground': surface['--muted-foreground']!,
    '--secondary-muted-foreground': surface['--muted-foreground']!,
    '--placeholder': placeholder,
    '--control-border': surface['--border']!,
    '--accent': surface['--accent']!,
    '--border': surface['--border']!,
    '--ring': controlPrimary,
    '--destructive': errorPalette[5]!,
    '--control-error': errorPalette[5]!,
    '--sidebar': surface['--sidebar']!,
    '--sidebar-foreground': surface['--sidebar-foreground']!,
    '--sidebar-submenu': surface['--sidebar-submenu']!,
    '--sidebar-submenu-foreground': surface['--sidebar-submenu-foreground']!,
    '--header': surface['--header']!,
    '--header-foreground': surface['--header-foreground']!,
    '--nav-active': selected,
    '--warm': surface['--secondary']!,
    '--shadow': shadow,
    '--popover': popover,
    '--popover-foreground': cardForeground,
    '--card-foreground': cardForeground,
    '--secondary-foreground': secondaryForeground,
    '--accent-foreground': secondaryForeground,
    '--accent-hover': dark ? '#3a3d40' : '#e3e6e8',
    '--primary-hover': hover,
    '--primary-active': active,
    '--primary-hover-foreground': '#ffffff',
    '--control-primary': controlPrimary,
    '--control-focus-border': overrides['--ring'] ?? controlPrimary,
    '--control-foreground': text,
    '--control-secondary-foreground': secondary,
    '--control-tertiary-foreground': tertiary,
    '--control-placeholder': overrides['--placeholder'] ?? placeholder,
    '--control-background': card,
    '--control-disabled-background': fillTertiary,
    '--control-disabled-foreground': placeholder,
    '--control-hover-background': fillTertiary,
    '--control-fill-secondary': fillSecondary,
    '--control-fill': fill,
    '--control-fill-alter': fillAlter,
    '--control-hover-border': hover,
    '--control-selected-background': selected,
    '--control-primary-border': primaryBorder,
    '--control-primary-border-hover': primaryBorderHover,
    '--control-focus-shadow': `0 0 0 2px ${outline}`,
    '--control-primary-shadow': `0 2px 0 ${outline}`,
    '--control-default-shadow': `0 2px 0 ${fillAlter}`,
    '--control-primary-outline': alphaColor(controlPrimary, 0.2),
    '--control-error-hover': errorPalette[dark ? 6 : 4]!,
    '--control-error-active': errorPalette[dark ? 4 : 6]!,
    '--control-error-background': errorPalette[0]!,
    '--control-error-border': errorPalette[2]!,
    '--control-error-focus-shadow': `0 0 0 2px ${errorOutline}`,
    '--control-error-shadow': `0 2px 0 ${errorOutline}`,
    '--control-switch-handle-shadow': '0 2px 4px 0 rgba(0,35,11,0.2)',
    '--popup-shadow': shadow,
    '--overlay-background': dark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.45)',
    '--table-header-foreground': dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.7)',
    ...overrides,
  };
}
