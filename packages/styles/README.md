# @niubu/styles

Private workspace source package. Import `./tokens.css`, then `./base.css`.
CSS is side-effectful; app shell, domain and legacy-table CSS remain app-owned.

Theme and density values have one canonical source: `@niubu/core-design` public
source exports. `src/tokens.template.css` owns the original Tailwind aliases,
selectors, typography and cascade. `scripts/tokens.ts` renders their static CSS.

Run `pnpm --filter @niubu/styles tokens:generate` explicitly after changing
canonical tokens or the template; commit the generated `src/tokens.css` with the
source change. `build` and `typecheck` only verify consistency and CSS export
resolution; they never write source or dist. The design dependency is tooling,
not a browser runtime import. `test` checks generation, stale-output rejection
and the theme/density selector contract with Node only.

Content color roles, typography, selected control sizes and popup width aliases
are exposed through `@theme inline`. Existing `shadow-sm` / `shadow-md` utilities
are intentionally unchanged: use `--popup-shadow-sm` / `--popup-shadow` explicitly
when adopting the design shadows. Fixed dimensions and z-index roles are available
as CSS variables; controls opt in separately. No component selectors are added by
the token generator.
