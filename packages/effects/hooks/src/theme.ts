import { parseThemeSnapshot, type ThemeSnapshotV2, type ThemeSnapshot } from '@niubu/core-preferences';
import {
  defaultThemeProfile,
  resolvePresentationTheme,
  validateBrandOverride,
  type BrandOverride,
  type ThemeProfile,
} from '@niubu/core-design';
import { applyThemeSnapshot } from './theme-dom.ts';
const owners = new WeakMap<HTMLElement, { dispose(): void }>();
export function createThemeRuntime({
  target,
  matchMedia,
  profile = defaultThemeProfile,
  brand = {},
}: {
  target: HTMLElement;
  matchMedia: (query: string) => MediaQueryList;
  profile?: ThemeProfile;
  brand?: BrandOverride;
}) {
  owners.get(target)?.dispose();
  let snapshot: ThemeSnapshotV2 | undefined,
    override = validateBrandOverride(brand),
    media: MediaQueryList | undefined,
    disposed = false,
    previousDark: boolean | undefined,
    last: ReturnType<typeof applyThemeSnapshot> | undefined;
  const attributes = new Map<string, string | undefined>();
  const styles = new Map<string, { value: string; priority: string }>();
  function render() {
    if (disposed || !snapshot) return;
    previousDark ??= target.classList.contains('dark');
    for (const key of [
      'theme',
      'density',
      'themePreset',
      'grayscale',
      'colorWeak',
      'semiDarkSidebar',
      'semiDarkSubmenu',
      'semiDarkHeader',
    ])
      if (!attributes.has(key)) attributes.set(key, target.dataset[key]);
    for (const key of [
      ...Object.keys(defaultThemeProfile.light),
      ...Object.keys(resolvePresentationTheme(snapshot.appearance, 'light')),
      '--presentation-filter',
    ])
      if (!styles.has(key))
        styles.set(key, { value: target.style.getPropertyValue(key), priority: target.style.getPropertyPriority(key) });
    last = applyThemeSnapshot(target, snapshot, media?.matches ?? false, profile, override);
  }
  function detach() {
    media?.removeEventListener('change', render);
    media = undefined;
  }
  const runtime = {
    apply(input: ThemeSnapshot) {
      if (disposed) return;
      snapshot = parseThemeSnapshot(input);
      if (snapshot.mode !== 'system') detach();
      else if (!media) {
        try {
          media = matchMedia('(prefers-color-scheme: dark)');
          media.addEventListener('change', render);
        } catch {
          media = undefined;
        }
      }
      render();
    },
    setBrand(next: BrandOverride) {
      if (!disposed) {
        override = validateBrandOverride(next);
        render();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      detach();
      if (owners.get(target) === runtime) owners.delete(target);
      if (previousDark === undefined || !last) return;
      for (const [key, value] of attributes) {
        if (target.dataset[key] !== last.attributes[key as keyof typeof last.attributes]) continue;
        if (value === undefined) delete target.dataset[key];
        else target.dataset[key] = value;
      }
      if (target.classList.contains('dark') === (last.mode === 'dark')) target.classList.toggle('dark', previousDark);
      for (const [key, saved] of styles) {
        if (
          target.style.getPropertyValue(key) !== last.variables[key as keyof typeof last.variables] ||
          target.style.getPropertyPriority(key)
        )
          continue;
        if (saved.value) target.style.setProperty(key, saved.value, saved.priority);
        else target.style.removeProperty(key);
      }
    },
  };
  owners.set(target, runtime);
  return runtime;
}
