# @niubu/locales

Private source workspace for owned bilingual resources and explicit display formatting. Each `createI18n` creates its own i18next instance and async runtime. No default singleton is initialized and no storage is owned here. `I18nProvider` and `useTranslation` are exported through `@niubu/locales/react`; the provider always supplies the owned SDK instance. Without a provider, public pattern fixtures use a stateless zh-CN resource lookup.

Two mutually exclusive construction paths are supported:

- `appNamespaces` plus `loadMessages(locale, signal)` loads a complete application language. The loader returns exactly the registered namespace dictionaries. [Playground](../../apps/playground/src/locales/index.ts) owns `app` and dynamically imports the selected complete language; it does not supply a synchronous app dictionary. The app awaits preparation before mounting, so individual pages do not introduce locale loading gates.
- The existing `appLoaders` maps application namespaces to `{load(locale,signal),fallback}`. Its bundled zh-CN fallback stays synchronously available for compatible existing consumers.

Both paths retain public Chinese fallback resources and reject application overrides of `common`, `validation`, or `shell`. Complete language results are validated, copied, cached per instance and shared by concurrent namespace requests. Failed or fully cancelled loads can be retried; aborted and disposed results cannot populate the cache. All required namespaces must be ready before active locale and the explicitly injected `{lang,dir}` target change. `preferredLocale` retains user intent on failure; a failed switch keeps the prior active language and mounted page state. Startup, preferences subscription, HTML target ownership, and disposal belong to the app’s [explicit owner](../../apps/playground/src/main.tsx).

Translation resources are flat string dictionaries. Dot and slash characters remain part of each key. Owned `t` splits only the explicit `namespace:` prefix and passes the remaining key to i18next with `nsSeparator:false`; route parameter colons such as `app:page./invite/:token` remain literal. Interpolation parameters are data and are resolved during rendering. Route metadata stores `titleKey`, `titleParams.titleKey`, and `groupKey`; it never freezes translated titles at module initialization.

`formatDateOnly(value,{locale})` validates a real `YYYY-MM-DD` and formats an immutable UTC calendar carrier with medium date style. `formatInstant(value,{locale,timeZone})` accepts only valid offset-bearing instants and uses the explicit reader zone. `formatCurrency(value,{locale,currency,precision})` requires an ISO currency and precision. `formatQuantity(measure,{locale,precision,labels})` distinguishes missing/unknown/known zero and retains the original unit. Locale never chooses currency, time zone, precision, business date, or source facts.

Run `pnpm --filter @niubu/locales test`. Root `pnpm locale:check` reads the actual public resources and each discovered frontend’s locale directory. Its Map identity convention is `public/zh-CN/common` or `app/en-US/app`; language key sets and interpolation parameter sets must match. Repeated parameters and parameter order do not change the set. The checker rejects application overrides of public namespaces.

Public components consume common/validation/shell; the app owns its namespace and domain copy. Display formatting uses the active locale and explicit options; raw values and source facts stay unchanged. Pure domain model/read code must never import an app binding.
