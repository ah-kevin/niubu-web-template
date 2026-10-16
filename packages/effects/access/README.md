# @niubu/access

Pure, caller-owned authorization and navigation projection. The root entry does not load React. Existing `canAccess`, `projectRoutes`, scope parsing and navigation APIs keep their existing behavior.

`resolveAccess(options)` takes `{ mode, routes, frontendMenu?, backendMenu?, access, roles, codes, scope, authenticated, baseURL }`. `routes` is the static `readonly RouteMeta[]` registry; `access` is the explicit capability and scope-membership snapshot. It returns frozen `{ menu, grantedPageIds, iframeItems, diagnostics }` collections and frozen tree nodes, without freezing caller inputs.

- `frontend` grants registered pages passing authentication, existing capability/scope checks, roles (any) and codes (all). Optional `ModuleMenu[]` selects visible pages; otherwise `navigation` selects them. Menu visibility never determines grants.
- `backend` grants only selected registered pages that also pass those code constraints. An absent/empty backend menu grants no protected pages. Code-declared `public` and `ignoreAccess` routes are explicit exceptions in all modes.
- `mixed` retains frontend grants and frontend-only entries, with backend presentation taking priority for the same page ID. A hidden backend selection also suppresses that frontend menu entry.

Page `href` always comes from the static route path plus the supplied scope query. Backend fields cannot replace paths, loaders or access constraints. Titles/icons fall back to `titleKey`/`iconToken`; code tab/breadcrumb/active-path metadata is copied explicitly. `hideInMenu` suppresses display while preserving grants. Backend nested groups and sibling order are preserved. Duplicate node IDs/page selections and unknown page IDs are skipped with diagnostics. Duplicate static route IDs keep the first declaration and report a diagnostic.

Frontend `parentId` declarations refer to page IDs. A parent with visible children becomes `group:<pageId>` with its original navigable page as a child. Denied parents promote authorized children. Invalid parent references/cycles are diagnosed; generated group-ID conflicts promote their children instead of emitting duplicate IDs.

Only backend DTOs produce external/iframe nodes. They require authentication and either null account scope or an actual member scope. URLs must be explicit HTTP(S) or resolve relative to the HTTP(S) `baseURL` origin; protocol-relative links, backslashes, control characters and other schemes are rejected. New-window nodes carry `target: '_blank'` and `rel: 'noopener noreferrer'`. `iframeItems` contains visible, authorized iframe nodes for an app-owned static container route. Rendering, sandbox policy and route registration remain with the app. Each call is independent; a revoked snapshot cannot reuse earlier grants.

## React binding

Import `AccessProvider`, `useAccess` and `AccessControl` from `@niubu/access/react`. Supply `value={{ codes, roles, ready }}` explicitly; missing providers throw. `useAccess().hasCodes(required, mode?)` defaults to `all`; `hasRoles(required, mode?)` defaults to `any`. Empty requirements impose no restriction when ready. `ready: false` always denies.

`AccessControl` combines the code and role requirements with AND. `mode` overrides the matching mode for each requirement list. The default `strategy="hide"` renders `fallback` when denied. `strategy="disable"` requires a render function and passes `{ allowed, disabled }`; connect `disabled` to the real native control:

```tsx
<AccessControl codes={['records.write']} strategy="disable">
  {({ disabled }) => <button disabled={disabled}>Save</button>}
</AccessControl>
```

These are presentation controls; API authorization belongs to the server. No owner, global session, credentials or dynamic route loading is created here.
