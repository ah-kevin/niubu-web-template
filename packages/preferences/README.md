# @niubu/preferences

An instance manager and injected React provider for non-sensitive display preferences.
Core values use validated defaults, app defaults, persisted values, then policy.
Core and unscoped extensions share the identity envelope. Explicitly scoped
extensions use separate envelopes without core copies. Extension handles retain
their registration scope; register a new handle when scope changes.

Only registered, validated extension values are written. When a bucket contains
stored namespaces whose schemas are still unregistered, updates stay in memory
and return a diagnostic without overwriting its disk envelope. Registering those
schemas validates their stored values; a later update can then save the complete
envelope, preserving current memory changes. Other buckets remain independent.
Unsupported future extension versions and invalid envelopes use defaults. Lower
versions pass through the extension's migration and validation.

Updates and resets change memory immediately. A write is reported as persisted
only after exact readback. Failures return memory with a reason. A caller owns
the injected manager and must dispose it; the provider only binds context.

App-owned legacy migration first confirms the data envelope, then attempts the
marker envelope. Failed marker readback leaves the manager unconfirmed and
retryable, though the storage implementation may already contain the marker.
StoragePort does not promise atomic transactions or rollback. Legacy raw keys
are retained. There is no shared instance, identity switch mutation, storage
event synchronization, business data, or credentials in the manager.
