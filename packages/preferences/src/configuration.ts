import { resolvePreferences, validateCorePreferencePatch } from '@niubu/core-preferences';

export type EffectiveConfigurationExtension = {
  namespace: string;
  version: number;
  validate: (value: unknown) => unknown;
  value: unknown;
};

/** The caller supplies the complete export allowlist; cached namespaces are never discovered. */
export function buildEffectiveConfiguration(
  core: unknown,
  extensions: readonly EffectiveConfigurationExtension[],
): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      core: resolvePreferences({ persisted: validateCorePreferencePatch(core) }),
      extensions: Object.fromEntries(
        extensions.map(extension => [
          extension.namespace,
          {
            version: extension.version,
            value: extension.validate(extension.value),
          },
        ]),
      ),
    },
    null,
    2,
  );
}

export async function copyEffectiveConfiguration(
  text: string,
  clipboard?: { writeText: (text: string) => Promise<void> },
): Promise<{ ok: boolean; text: string }> {
  try {
    if (!clipboard) return { ok: false, text };
    await clipboard.writeText(text);
    return { ok: true, text };
  } catch {
    return { ok: false, text };
  }
}
