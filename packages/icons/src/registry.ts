import type { ComponentType, SVGProps } from 'react';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
export type IconEntry = Readonly<{ name: string; icon: IconComponent }>;
export type IconRegistryOptions = Readonly<{
  fallback?: IconComponent;
  onUnknown?: (name: string) => void;
}>;
export type IconRegistry = Readonly<{ resolve(name: string): IconComponent | undefined }>;

/** Explicit registration only: no global defaults or dynamic icon imports. */
export function createIconRegistry(entries: readonly IconEntry[], options: IconRegistryOptions = {}): IconRegistry {
  const icons = new Map<string, IconComponent>();
  for (const { name, icon } of entries) {
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.:-]*$/.test(name)) throw new Error(`invalid icon name: ${name}`);
    if (icons.has(name)) throw new Error(`duplicate icon name: ${name}`);
    icons.set(name, icon);
  }
  const { fallback, onUnknown } = options;
  return Object.freeze({
    resolve(name: string): IconComponent | undefined {
      const icon = icons.get(name);
      if (icon) return icon;
      onUnknown?.(name);
      return fallback;
    },
  });
}
