# Product Starter and Generator Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in this session. The user explicitly authorized complete implementation on 2026-10-20; execute sequentially without new per-stage approval.

**Goal:** Deliver a maintained admin starter and a commit-based product generator with optional public scope conversion.

**Architecture:** `apps/starter` owns its explicit runtime, login and four system pages. The backend selects independent profiles. A small Node CLI materializes an allowlisted committed tree into a new directory, transforms controlled product fields and package scope, verifies structure, then writes a deterministic manifest. Playground stays available.

**Tech Stack:** Existing React/Radix, Tailwind/Vben, pnpm, Vite, TypeScript, Vitest and Nitro. No third-party additions.

**Spec:** /Users/bjke/Library/Mobile Documents/iCloud~md~obsidian/Documents/agent-workspaces/Notes/Plans/2026-10-19-NiuBu-Web-4-1-4-2-管理后台样板与生成器方案-v2.md

## Global Constraints

- Template source only; business HEAD `7c7c51a` and requests disabled/291 routes/67 menus remain unchanged.
- Keep public exports and explicit owner/dispose; no app-to-app imports or generic CRUD framework.
- Four resources do not mutate authentication accounts or grants; one default workspace, admin/viewer fixtures.
- Default public scope `@niubu`, optional `--public-scope`; internal scope stays `@niubu-internal`.
- Existing `pnpm check` and `pnpm format:check`, incremental caches preserved. No automated E2E, push or publication.
- Existing checkout is clean and exclusively owned by this native executor; use feature branch `codex/product-starter-generator`, preserve master until delivery. No extra worktree or duplicate dependency setup needed.

## Review Focus

1. Another identity/expired session must never reuse an admitted write or stale query result: starter lifecycle/CRUD tests.
2. Editing a system user/role/menu must not mutate authentication configuration: backend profile tests.
3. Preview/apply target drift, symlinks and nested destinations must not overwrite source/user data: generator filesystem tests.
4. Custom scope must cover package keys and hard-coded tooling with internal scope unchanged: scope consistency tests plus actual generated-product checks.
5. Committed source only, complete lock importers and deterministic manifest (source commit timestamp, not wall clock): generator provenance/reproducibility tests.

## Task 1: Independent starter backend profile

**Files:** `apps/backend-mock/src/profiles.ts`, `src/profiles.test.ts`, `plugins/api.ts`, backend README.

**Interfaces:** `createStarterMockConfig(): MockConfig`, `selectMockConfig(profile: string | undefined): MockConfig`. Profile selector reads `MOCK_PROFILE`; default stays Playground. Starter has north membership only, admin/viewer, home and four page IDs, isolated system seeds.

- [x] Write profile tests for login/menu/grants, viewer write rejection, CRUD/grant separation and default isolation; run RED.
- [x] Implement profile and selector; run GREEN and backend tests.

## Task 2: Real admin starter workspace

**Files:** `apps/starter/{package.json,vite.config.ts,vitest.config.ts,src/**}`, root Turbo/lock/docs, template Root contract tests.

**Interfaces:** `startStarter(element, options)` owns restore-first stores/i18n/query/theme/auth/router. Registry includes `/login`, protected `/home`, four `/system/*`, account profile; app config explicitly contains starter identity. API retains system contract, no transfer/example routes.

- [x] Add startup/auth/CRUD tests against independent backend; watch RED before app exists.
- [x] Adapt proven Playground app-owned wiring without cross-app imports; retain forms/tree implementations and local fixtures. No example/transfer demo routes.
- [x] Wire locale, app selection, Turbo build inputs/output, runtime/theme/first-screen and dependency importer. Keep existing Playground assertions and add starter contract.
- [x] Run focused startup/CRUD, default check and formatting; record browser proof.
- [x] Commit starter/backend app work separately from generator tools.

## Task 3: Deterministic commit-based generator

**Files:** `internal/scripts/src/product-generator.ts`, `product-transform.ts`, `create-product.ts`, nearby tests, `package.json`, product-generation guide.

**Interfaces:** `planProduct({sourceRoot, templateRef, targetDir, productSlug, displayNameZh, displayNameEn, defaultLocale?, publicScope?})` returns in-memory plan and deterministic manifest; `applyProduct(plan)` rechecks target/source and exclusively creates only planned files. CLI defaults to dry-run; `--apply` is explicit.

- [x] Write temporary Git fixture tests: dry-run zero writes, committed-vs-dirty source, illegal identifiers/scopes, nonempty/symlink/nested paths, reproducibility and scope collisions. Watch RED.
- [x] Read Git tree/blob/mode by exact resolved commit; reject symlinks/submodules and unsupported committed shapes. Allowlist source/config/docs/assets, exclude private env/history/output/evidence. Starter maps to web; generator-owned transforms update identity/auth keys/page IDs/locale/mock profile, root product metadata and build/Root contracts.
- [x] Rename lock importer starter→web while preserving existing version resolutions, scope dependency keys and fixed catalog. Reject invalid lock shape. Use existing parser/formatter only.
- [x] Apply registered public-package scope mapping across copied source/text configs, preserving suffix and internal scope; parse package graph, reject missing/stale names. Deterministic manifest includes commit/source timestamp and SHA/mode, not absolute target or per-run timestamp.
- [x] Stage in a sibling owned directory, verify all transformations before creating target, refuse drift/no force; cleanup only owned staging artifacts on error. Explain filesystem atomicity limits.
- [x] Run focused tests, source scripts tests, type/lint; document CLI/default and custom scope commands (implemented commands only).

## Task 4: Real consumer verification and delivery

- [x] Commit the verified template sources locally so generation uses a real source commit.
- [x] Generate two products under ignored scratch: default scope and `@acme`; repeat one to prove deterministic contents and collision refusal.
- [x] Install with existing lock/version policy (no new dependency versions), run both products `pnpm check` and `pnpm format:check`; confirm public scope graph and internal names.
- [x] Through Chrome/IAB inspect starter and generated scoped consumer login, four pages, tree interactions, read-only account, language/theme and overlay focus. No Playwright runner/scripts.
- [x] Fresh branch review (independent reviewer if allowed by execution skill), address substantive findings with focused tests, rerun default checks only for changes.
- [x] Local commit/merge, keep remote unchanged; Task/Case writeback includes actual receipts and limitations. Cleanup disposable generated products/services/staging; preserve useful ignored evidence.
