# Playground existing-capability examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the leader and test-driven implementation for disjoint helpers. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the human-confirmed existing subsets of 49 Vben comparison entries, keep 23 gaps documented, with reachable Playground pages and meaningful component tests.

**Architecture:** Existing DomainModule registration, static lazy loaders and bilingual keys own every page. Group related scenarios into focused pages and use existing public exports; demonstration fixtures are explicitly synthetic, isolated from live auth and production data. Keep shared package changes separate from app examples if any are necessary.

**Tech Stack:** React, existing @niubu workspace exports, Zod, TanStack React Query, Vitest/Testing Library. No dependency changes.

**Spec:** [Confirmed capability comparison](../../guide/vben-examples-comparison.md); Task `Tasks/NiuBu Web 模板 2-3 Playground 对标 Vben 补齐组件示例.md`, user confirmation 2026-10-17.

## Global Constraints

- Human: “确认，先做已有能力和部分能力里的现有子集，缺口先保留。恢复模板写入通道，需要提权就申请，继续完成2-3，验收通过后合并本地master，不推送。”
- Template only; no implementation sync to niubu-saas. No new/upgraded dependencies, E2E, Docker, push, remote changes or rewritten pushed history.
- Existing feature branch starts at master6110087; native escalation before sibling writes/cache-producing commands. No service startup needed for component gates; never touch5173.
- Scope mapping below is exhaustive for approved main rows; 35 support files follow their main row's existing subset, including typed props/composition, not missing factory/keepalive/drag/lock/placement contracts. R01–R08 only existing safe state/external/embedded behavior.
- No VXE, array engine, rich editor, advanced tooltip, fixed header, virtualization, menu-visible403, dynamic tab title or DOM keepalive implementation.

## Review Focus

- Invalid/hidden fields and cancelled submit: validation focuses visible field and stale work cannot apply; form component tests own these.
- Table query changes and late responses: reset/reload/scope cancel must preserve current result; table tests own these.
- Auth/role demo must use isolated synthetic owner and never mutate current login or replay writes; application tests own these.
- Menu registration must remain static and preserve unknown/backend authorization behavior; module and mock-menu tests own these.
- Unmounted examples must release query/controller/overlay/preference resources; each owning interaction test checks cleanup, final independent review checks all owners.

## Task 1: Forms (E43,E44,E46,E47,E48,E51,E52,E53,E54)

**Files:** Create `apps/playground/src/examples/forms/{FormsPage.tsx,FormsPage.test.tsx}` and focused helpers within that directory only.
**Interfaces:** Export `FormsPage(): React.JSX.Element`; consumes existing useSchemaForm/FormFrame/Query APIs. Nine sections or clear scenarios:11builtin fields, public get/set/reset/validate/submit/cancel/updateFields, column/JSX layout, custom renderer seam, pure derive, query collapse, synchronousZod, submit error focus, raw values versus toOutput DTO.
- [x] Write failing component interactions: invalid submit prevents output/focuses error; field derivation; programmatic patch/reset; raw/output transform; query reset/collapse as relevant.
- [x] Run `pnpm --filter @niubu/playground exec vitest run src/examples/forms/FormsPage.test.tsx` and record actual RED.
- [x] Implement using only declared/public APIs; no schema insert/remove, asyncrefine, RHF imports, array/merge/label measurement or bilateral codec.
- [x] Run same suite + app typecheck; fix and record actual GREEN. Leader registers menu/locale.

## Task 2: DataTable (E63,E64,E67,E68,E69)

**Files:** Create `apps/playground/src/examples/tables/{TablesPage.tsx,TablesPage.test.tsx}` and focused private fixture/helpers there only.
**Interfaces:** Export `TablesPage(): React.JSX.Element`; consumes existing DataTable/QueryDataTable/useQueryDataTable and typed columns/preferences.
- [x] Write failing tests for sorting/paging/selection/custom-cell, column settings/pinning, query/reset/reload and cancelled stale server response.
- [x] Run `pnpm --filter @niubu/playground exec vitest run src/examples/tables/TablesPage.test.tsx`; record RED.
- [x] Implement synthetic controlled list/server fixtures and public table profiles. Clearly label as DataTable; no VXE API, inline edits, fixed header/tree/view history/virtualization.
- [x] Same tests GREEN + typecheck, leader integrates route.

## Task 3: Basic controls and feedback (E33,E38,E41,E57,E58,E61; R01–R04)

**Files:** Create `apps/playground/src/examples/components/{ComponentsPage.tsx,ComponentsPage.test.tsx,FeedbackPage.tsx,FeedbackPage.test.tsx}` and focused helpers there only.
**Interfaces:** Export ComponentsPage and FeedbackPage; basic Button/RadioGroup/Checkbox/context-menu/stringTooltip; controlledModal/Drawer/fullscreen/title/confirmLoading/typed-data/form composition; ReadState/RoutePending; SystemStatePage props and error boundary.
- [x] Write failing tests for control output, conditional menu action, overlay confirm/close/unmount/typed value/queue and state actions.
- [x] Run component directory tests; record RED before implementation.
- [x] Implement with public APIs and isolated fixture state, preserve close unmount; no advanced group limit/beforeChange, draggable/lock/fullmask, animation callbacks, retain-instance, prompt/programmaticbeforeClose.
- [x] Same tests GREEN + typecheck. Shared package fixes if necessary proposed to leader, not edited by helper.

## Task 4: Application/navigation/request/query examples (E01–E03,E05–E17,E19–E27,E29–E32; R05–R08)

**Files:** Create `apps/playground/src/examples/application/`, module `src/modules/examples.tsx`, bilingual app resources, backend synthetic menu entries. Modify existing module aggregate and route binding only as required for existing page tabs integration.
**Interfaces:** Named page exports for Access, Navigation, BrowserFeatures, RequestFeatures, Query, Preferences and Tabs pages; leader owns all integration.
- [x] First failing tests for synthetic role/code any/all, tree menu/badge/hidden child/breadcrumb/newwindow, safe query params, expiry code strictness, paginated/retry/infinite/deduped Query and isolated preferences, tab controller cleanup/refresh.
- [x] Run focused suites and preserve RED logs.
- [x] Implement via existing public APIs; fixtures explicitly synthetic. Query keys include identity/scope/generation; only safe GET retries; throw request failures. Existing transfer save adapter reused; textwatermark and root fullscreen only. Icons explicit registry; preferences extension only. Embedded sample uses local safe content and no relaxed sandbox/remote verification.
- [x] Register static lazy pages under examples menu with stable ids and bilingual keys, mock pages selected by demo:read. Update existing route test expectations without weakening unknown-id/auth checks.
- [x] Focused GREEN, type/lint/locales/workspace + complete app tests.

## Task 5: Integration, independent review, delivery

**Files:** guide comparison updated from reviewed Task payload; create `docs/verification/2026-10-17-round2-playground-examples.md`; ignored audit stores actual logs. Case plans registers this file via labeled file URL.
- [x] Crosswalk all49 approved main rows plus support and8 supplemental entries to concrete pages/sections; document every deferred gap without claiming unsupported features.
- [x] Run `pnpm format:check` and cold `pnpm check` with inherited TURBO_* removed and original cache restored using existing audit runner; preserve all failures and reruns.
- [x] Fresh reviewer, uninvolved in implementation, verifies scope coverage, behavior, owners, public API and no dependency/source boundary drift; fix confirmed findings with meaningful RED/GREEN and rerun affected/full gates as justified.
- [ ] Commit public/internal changes separately if any; commit app/example/docs on feature branch after checks/review. Merge local master (fast-forward if applicable), delete merged feature branch. No push.
- [ ] Task3 done + fresh trusted gate, parent rollup/complete, Case Current/Progress/DoD/final delivery accurately saved. User visual pnpmdev remains manual acceptance, not browser/E2E PASS. Stop natural idle, no notifications/park/archive/close.

Execution evidence: final cold check 0 / 80.830s; format 0 / 1.747s; Root99, Playground183, backend293, scripts305. Independent reviews closed 1P1/4P2 and documentation support omission. Final commit/merge and Task/Case operations are recorded in the linked verification and Case delivery records.
