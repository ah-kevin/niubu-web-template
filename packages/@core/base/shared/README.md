# @niubu/core-shared

Private version 0.1.0 workspace source package. Consumers use only the explicit exports in package.json.

The root export supplies parseQuery/writeQuery/mergeQuery/parseTab, businessDateAt,
measureQuality, parseCalendarDate, parseInstant and createReturnPathResolver.
Each return resolver closes over its caller policy and trusted default; there is
no global registered route policy.

`measureQuality` returns known/missing/unknown without choosing display prose.
`parseCalendarDate` and `parseInstant` strictly validate calendar/leap/offset facts;
`businessDateAt` depends only on a valid instant and an explicit business zone.

Locale-dependent Intl display belongs to `@niubu/locales`:
formatDateOnly, formatInstant, formatCurrency and formatQuantity. The caller supplies the active locale and
explicit time zone, currency and precision; see the
[public formatters](../../../locales/src/formatters.ts). Raw units, source facts and business
dates remain unchanged. The pure shared package and `@niubu/utils` facade do not
export the former formatInstant/formatMeasure display functions.
