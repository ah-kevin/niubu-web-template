# @niubu-internal/scripts

Private source workspace for workspace validation and build verification. Source exports execute directly on Node.js meeting the workspace minimum version; `build` checks types without emitting `dist`.

[Playground](../../apps/playground/package.json) runs `tsc --noEmit && node ../../internal/scripts/src/build-app.ts`. The CLI loads the actual app Vite config and awaits `vite.build()` (including all write/close hooks), then invokes the typed `niubu:build-provenance` plugin API `finalize()`. There is no registry or server startup. Calling Vite directly leaves an unsealed build, which the budget gate rejects.

`budget:check` measures the existing `apps/playground/dist` against the current canonical source input hash from node-utils. Turbo makes `budget:check` depend on the selected app’s `build`; build never depends on budget. Source hash includes runtime dependencies/peers/optional, separate tooling sources, package/export/config/env inputs and the lockfile. Future canonical design values and CSS generators under source/scripts/tools are covered without adding a build output package.

Every actual named first-screen variant includes HTML entry, preloads, classic scripts and the declared module-to-chunk mappings. Adding a root label does not add a Rollup entry or change lazy loading. Static ES imports/exports form the recursive deduplicated closure; each emitted JS file is charged using gzip level 6, against a 307200-byte benchmark per variant and union. Size is `report-only`: the actual `withinBudget` remains false when exceeded; invalid provenance still fails. CSS is reported separately. Browser/network acceptance is a later authorized check.

The temporary workspace cache test alone passes `verify-deps-before-run=false` in its child subprocess arguments/environment to prevent pnpm from syncing the reused, already verified repo node_modules into the synthetic fixture. It does not change process-global environment or repo/app configuration, package age or trust policy. Actual app cache verification always uses normal pnpm policy.

The build CLI accepts one optional positional root plus `--mode` / `-m`, `--base`, and `--config` / `-c` (space or equals values), including pnpm-forwarded options with or without its leading `--` separator. Unknown/unsupported options and multiple roots fail explicitly. Watch, SSR, server commands and the rest of Vite's CLI option set are not exposed by this one-shot verification CLI; supported configuration remains in the actual Vite config.

The source/env/lock `inputHash` remains the public canonical hash. A separate `buildContext` seal binds it to resolved mode/base/configFile/root/outDir/envDir, hashed effective environment, explicit config/dependencies and actual root/env file inputs. Missing optional env files are recorded too. Build start/end re-read these bytes. Budget measurement requires an independently resolved expected context and rechecks extra source bytes; a staging/alternate/manual layout build cannot masquerade as the default build.

`measureBuiltOverview({appRoot,workspaceRoot,expectedInputHash,expectedBuildContext})` stays synchronous and uses the actual configured outDir. `measureCurrentOverview(root)` and the old root compatibility `measureBuiltOverview(root)` now return a Promise: callers must await the live default production `resolveConfig` before measurement. The CLI awaits this path. API contracts are defined by [budget.ts](src/budget.ts); browser/E2E checks require separate authorization under the [root rules](../../AGENTS.md).

`pnpm locale:check` executes `locale-check.ts` against actual public resources
and each discovered frontend’s locale directory, currently [playground locales](../../apps/playground/src/locales/index.ts). `checkLocales(ReadonlyMap)` uses identities in the
form `owner/locale/namespace` (`public/zh-CN/common`, `app/en-US/app`). Dictionaries
contain flat string keys. Both languages must provide identical key sets and
interpolation parameter sets; repeated/reordered `{{value}}` slots are valid.
The application owner cannot override public common/validation/shell namespaces.
