# @niubu/hooks

StoragePort reports explicit read/write success or failure. createStoragePort
uses supplied storage operations, or resolves browser storage only at call time.
The manager confirms writes with a separate readback; this adapter has no cache
or shared instance and does not decide which preference schema to persist.

`createLocaleRuntime({defaultLocale,loadResource,fallbackResources,domTarget?})`
consumes an injected abort-aware loader and bundled zh-CN fallback resources.
It caches/deduplicates `(locale,namespace)` within one instance, retries failed
requests, and treats language intentions as generations. Late settlements cannot
change a newer generation. `ensureNamespaces` joins current switch requirements;
only the whole set activates. Superseded/disposed work settles without activation.
Failures reject the current operation and preserve its preferred intention and
prior active locale. Disposal aborts pending requests and clears subscriptions.
The explicit DOM target is updated only by successful activation; hooks import
no catalog/preferences and own no language storage or implicit document target.
