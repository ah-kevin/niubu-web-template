# @niubu/common-ui

Private version 0.1.0 workspace source package. Consumers use only the explicit exports in package.json.

Import ./page-header, ./detail-frame, ./read-state, ./filter-bar, ./form-frame, ./quick-view, ./action-preview or ./unsaved-guard. ./form-frame also exports useRestorableForm. Import ./styles.css for the existing pattern CSS. ./return-path exports ReturnPathProvider/useReturnPathResolver: inject an app-owned resolver into each mounted tree. An unbound tree rejects return destinations to /. Components receive navigation callbacks; no app, router, chart or CSV dependencies. The `./data-table`, `./form`, `./preferences`, `./auth`, `./overlay`, and `./system-state` entries expose shared table, schema form, preferences, authentication, overlay and state components. See the [form and CRUD guide](../../../docs/guide/forms-query-crud.md) and [public exports](package.json).

`./display-preferences` exports controlled theme/density choices and core-derived DisplayPreferences. Labels use the public shell namespace; callbacks and persistence diagnostics are caller inputs. Original display CSS is owned by the public `./styles.css` export.
