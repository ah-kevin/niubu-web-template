# @niubu/core-preferences

Private workspace package with public source exports and no runtime dependencies.

`resolvePreferences` merges builtins → app defaults → validated persisted patch
→ policy. Defaults are zh-CN, system theme, standard density and expanded sidebar.
`validateCorePreferencePatch(unknown)` drops invalid and unknown fields instead
of filling builtins first, so valid app defaults survive corrupt persisted data.
`resetPreferences` uses builtins, app defaults and policy, ignoring persistence.
Every result is a separate mutable value; frozen builtins remain unchanged.

`mergeValidatedPreference<T>` operates on already validated JSON preference
values. Nested object patches preserve siblings; arrays replace as complete
values. Both base and patch are cloned. Undefined patches are ignored and unsafe
prototype keys are dropped. It is not an unknown-data validator.

`PreferenceExtension<T>` owns its namespace, version, defaults, validation and
migration; UI renderers do not belong here. `parseThemeSnapshot` shares pure
mode/density guards and returns only schemaVersion/mode/density. Unknown versions
fall back as a whole to schema 1/system/standard; invalid schema 1 fields fall back
individually. Storage, extension registration and DOM effects belong to consumers.
