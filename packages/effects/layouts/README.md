# @niubu/layouts

Private source exports. BusinessShell binds public preferences, locale labels and caller-owned store UI to controlled core layout/menu primitives. PublicShell and AccountShell bind the same public preference and locale capabilities. Navigation is already projected by the caller; no app registry, Router or domain rules are imported.

Consumers import the public `@niubu/menu-ui/styles.css` and `@niubu/layout-ui/styles.css` after shared base styles. App brand, search, notification, scope preview, readonly legend, story and return policy remain app slots with their owning app styles. Closed mobile content loads only after the caller requests opening.
