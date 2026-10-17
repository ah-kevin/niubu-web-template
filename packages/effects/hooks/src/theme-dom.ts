import { parseThemeSnapshot, type ThemeSnapshot } from '@niubu/core-preferences';
import {
  defaultThemeProfile,
  resolvePresentationTheme,
  type BrandOverride,
  type ThemeProfile,
} from '@niubu/core-design';
/** Shared synchronous, presentation-only classic and runtime DOM contract. */
export function applyThemeSnapshot(
  target: HTMLElement,
  input: ThemeSnapshot,
  systemDark: boolean,
  profile: ThemeProfile = defaultThemeProfile,
  brand: BrandOverride = {},
) {
  const snapshot = parseThemeSnapshot(input);
  const mode = snapshot.mode === 'system' ? (systemDark ? 'dark' : 'light') : snapshot.mode;
  const appearance = snapshot.appearance;
  const attributes = {
    theme: mode,
    density: snapshot.density,
    themePreset: appearance.preset,
    grayscale: String(appearance.grayscale),
    colorWeak: String(appearance.colorWeak),
    semiDarkSidebar: String(appearance.semiDarkSidebar),
    semiDarkSubmenu: String(appearance.semiDarkSubmenu),
    semiDarkHeader: String(appearance.semiDarkHeader),
  };
  Object.assign(target.dataset, attributes);
  target.classList.toggle('dark', mode === 'dark');
  const variables = {
    ...resolvePresentationTheme(appearance, mode, profile, brand),
    '--presentation-filter':
      [appearance.grayscale && 'grayscale(1)', appearance.colorWeak && 'invert(1)'].filter(Boolean).join(' ') || 'none',
  };
  for (const [key, value] of Object.entries(variables)) target.style.setProperty(key, value);
  return { mode, density: snapshot.density, attributes, variables };
}
