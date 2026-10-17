# Round 2 Independent Mock Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans with focused native helpers; tests fail before implementation. Leader owns TaskNotes, Case, integration and Git.

**Goal:** Make backend-mock a standalone development service, connect Playground through an explicit proxy, then synchronize mock to the business repo and remove its Playground.

**Architecture:** Preserve Nitro, the in-memory dispatcher, envelopes, authentication, CRUD and transfers. Separate configurable fixtures/routes from service machinery; start mock in its own terminal. Playground uses an explicit developer proxy target; no process ownership inside app configuration. Keep public package code and business app behavior intact.

**Tech Stack:** Existing Node >=24.16, pnpm 11.25, Nitro 2, Vite 8, Vitest, React; no dependency changes.

**Spec:** TaskNotes API: Tasks/NiuBu Web 模板第二轮 mock 独立与示例补齐.md and subtask 2-1/2-2/2-3. Full API/contract/gate accepted by the same native leader on 2026-10-17.

## Global Constraints

- Feature branches from master fa9602c (template) /6d755bc (business); local commits and merge to master only after relevant checks and independent review. User-authorized scope amendment permits deleting merged local branches; no push, remote deletion, rewriting pushed history, remote creation or release.
- No E2E, new/upgraded dependencies, timeout extensions, weaker assertions or credential files.
- apps/web source unchanged; 291 routes, 67 menu projections and >=2009 tests. No hooks install in niubu-saas.
- Only 127.0.0.1 temporary services, owned lifecycle; do not touch 5173 or discover/kill unknown processes.
- Cold full checks: move owned .turbo/cache aside and restore after; never inject TURBO_FORCE into tests.
- 2-3 comparison only; put the complete table in its Task, register Case, write 等待用户确认 and stop before any example implementation.

## Review Focus

- Replacing fixture accounts/menu identifiers must preserve scope checks and prevent old defaults from leaking into custom configurations.
- Custom endpoints must not override built-ins or bypass shared response/body/lifecycle rules.
- App proxy selection must reject invalid targets and must not import backend runtime into production output.
- Missing or occupied standalone service must fail clearly; cleanup can only close owned handles and prove port release.
- Cache tests must ignore every inherited TURBO_* variable, retain meaningful cache-hit/miss assertions and existing timeouts.

## 2-1 Template standalone mock

- [ ] Add behavioral RED tests for replacing accounts/menu/resource defaults, extending endpoints and isolation; implement configuration types/factory in apps/backend-mock/src and wire Nitro plugin to explicit mock config.
- [ ] Add RED for inherited TURBO_* contamination; sanitize only nested fixture Turbo environments, keep normal build environment intact. Files internal/scripts/src/cache-provenance.test.ts and its focused regression helper/test if needed.
- [ ] Add RED for standalone startup options/proxy target, and absence of an embedded starter; implement apps/backend-mock startup script (default 127.0.0.1:5320) and Playground explicit proxy config (default http://127.0.0.1:5320). Remove automatic starter/plugin tests and adapt owned runtime proof to start the backend separately from Vite.
- [ ] Update README/guide with startup, app integration, fixture replacement and endpoint extension; preserve exact E2E authorization paragraph.
- [ ] Run focused tests/types/lint then format:check and cold pnpm check. Prove production excludes mock.
- [ ] Independently review, fix with RED where behavioral, run actual owned standalone HTTP health/login/menu and frontend proxy/CRUD smoke; close all owned services and rebind ports.
- [ ] Commit reviewed code locally and write actual commands/exits into 2-1 Task; verify trusted_done.

## 2-2 Business sync and cleanup (only after 2-1)

- [ ] Capture fresh pre-cleanup apps/web production asset hashes from a real build with unchanged configuration.
- [ ] Add RED for cleanup invariants and generic fixture behavior; copy only the 2-1 backend/internal patch with source commit recorded. Refactor shared-script test fixtures in template first when necessary, then synchronize those patches.
- [ ] Remove apps/playground and Playground-only Root integration suites/helpers; remove obsolete launcher/Turbo/Docker/CI/lock importer references. Keep backend-mock/tests/nitropack and all public packages/internal runtime capabilities.
- [ ] Update guides/Agent references to the independent template or existing web examples; preserve exact E2E authorization bytes.
- [ ] Run format, boundary, links, cold full check; compare web JS/CSS/HTML hashes and explain provenance-only differences. Require web>=2009, route291/menu67.
- [ ] Independently review and fix; real standalone mock start/health/close/rebind in business repo. Commit locally without installing hooks; write 2-2 Task and fresh gate.

## 2-3 Vben comparison gate

- [ ] Read pinned Vben 151d80f9 examples and demos; inventory every example with corresponding actual exported capability and proposed page, or explicit gap/options.
- [ ] Independent completeness review; write full comparison table into 2-3 Task, register exact repository document in Case if produced.
- [ ] Write blocked in 2-3 and parent, Case Current 等待用户确认; all temporary services stopped. Keep idle with no notifications.
