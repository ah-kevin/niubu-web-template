# @niubu-internal/vite-config

Private source workspace for shared web configuration. React/Tailwind and public workspace build-input helpers are declared dependencies.

The provenance plugin records actual bundle module-to-chunk mappings without creating entries. Its typed `api.finalize()` must be called by the build CLI after `vite.build()` resolves, so the seal binds final on-disk HTML, manifest, all chunks/assets and first-screen roots. Input hashes at build start and finalization must match. Build start removes any old seal; failed or direct unfinalized builds cannot pass the budget gate.

The frontend emits to its configured outDir, currently `apps/playground/dist`; this source-only tool’s build is `tsc --noEmit`. See the [playground Vite configuration](../../apps/playground/vite.config.ts).

Resolved build context, including config-defined mode/root/layout overrides, is captured at build start and bound through a separate contextHash. Explicit config/dependency and actual envDir/mode file hashes are rechecked at finalization. The plugin writes to `resolve(config.root, config.build.outDir)` and normalizes the workspace's real path for source ownership; declared roots still reference their configured source paths and never introduce entries.
