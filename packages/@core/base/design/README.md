# @niubu/core-design

Private workspace package with public source exports. No browser or IO dependency.

`defaultThemeProfile` contains the existing readonly light/dark semantic color
maps and shadow. `densityTokens` separately owns standard/compact dimensions.
`resolveTheme(profile, mode, brand = {})` returns a frozen, fresh semantic map;
it never sets density dimensions inline. Missing or invalid profile values use
the corresponding original defaults. Unknown keys are discarded.

`validateBrandOverride(unknown)` accepts only `--primary`,
`--primary-foreground`, `--ring`, and `--accent` with #RGB/#RGBA/#RRGGBB/#RRGGBBAA
values. Resolving a brand never mutates defaults or another result. Profile
colors use hex and shadows use 2–4 pixel lengths followed by hex; arbitrary CSS
cannot pass through the resolver.

`@niubu/styles` consumes these exports at build time to generate static CSS.
DOM application, system theme detection and persistence belong to effects.
