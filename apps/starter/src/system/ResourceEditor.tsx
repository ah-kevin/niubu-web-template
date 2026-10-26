import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSchemaForm } from '@niubu/common-ui/form';
import { FormFrame } from '@niubu/common-ui/form-frame';
import { Button } from '@niubu/shadcn-ui/button';
import './ResourceEditor.css';
import { useTranslation } from '@niubu/locales/react';
import { useInteractionState } from '@niubu/stores';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthContext } from '@niubu/types';
import { useStarterApi } from '../app/api-context';
import { useAuthSnapshot, useStarterAuth } from '../auth/context';
import type { InputByResource, RecordByResource, ResourceKind } from './contracts';
import { createEditorOptions, editorDefaults, type EditorValues } from './form-schemas';
import { ownerScopeKey, resourceConfig, resourceDraftKey, type Lookups } from './resource-config';
import {
  cancelled,
  invalidateResource,
  requireLease,
  sameOwner,
  systemErrorCopy,
  writeWithRecovery,
} from './resource-runtime';

export type ResourceEditorProps<K extends ResourceKind> = {
  resource: K;
  record?: RecordByResource[K];
  initialParentId?: string;
  owner: AuthContext;
  lookups: Lookups;
  lookupReady: boolean;
  onCancel: () => void;
  onSubmitted: (record: RecordByResource[K]) => void;
  onCancelReady: (cancel: (() => void) | null) => void;
};
export function ResourceEditor<K extends ResourceKind>({
  resource,
  record,
  initialParentId,
  owner,
  lookups,
  lookupReady,
  onCancel,
  onSubmitted,
  onCancelReady,
}: ResourceEditorProps<K>) {
  const { t } = useTranslation('app');
  const api = useStarterApi(),
    auth = useStarterAuth(),
    state = useAuthSnapshot();
  const queryClient = useQueryClient(),
    interaction = useInteractionState();
  const scopeKey = ownerScopeKey(owner.identityKey, owner.scope),
    draftKey = resourceDraftKey(resource, record?.id, initialParentId);
  const [draft] = useState(() => interaction.readDraft(scopeKey, draftKey));
  const [recovering, setRecovering] = useState(() => draft !== undefined);
  const options = useMemo(
    () =>
      createEditorOptions(
        resource,
        t,
        lookups,
        record,
        editorDefaults(resource, record, initialParentId),
        initialParentId,
      ),
    [resource, t, lookups, record, initialParentId],
  );
  const savedRecord = useRef<RecordByResource[K] | null>(null);
  const schema = useSchemaForm<EditorValues, InputByResource[K]>(options);
  const { updateFields, getValues, filterDraft } = schema;
  useEffect(() => {
    updateFields(createEditorOptions(resource, t, lookups, record, getValues()).fields);
  }, [resource, t, lookups, record, updateFields, getValues]);
  const current = api.getContext();
  const writable = Boolean(
    current &&
    sameOwner(owner, current) &&
    state.status === 'ready' &&
    !state.loginExpired &&
    state.codes.includes(`system:${resource}:write`) &&
    lookupReady,
  );
  const formId = useId();
  async function submit(values: EditorValues, { signal: operationSignal }: { signal: AbortSignal }) {
    const context = api.getContext();
    const snapshot = auth.getSnapshot();
    if (
      !context ||
      !sameOwner(owner, context) ||
      snapshot.status !== 'ready' ||
      snapshot.loginExpired ||
      !snapshot.codes.includes(`system:${resource}:write`) ||
      !lookupReady
    )
      throw cancelled();
    const signal = AbortSignal.any([operationSignal, auth.requestContext().signal]);
    const input = schema.toOutput(values);
    const port = api.system[resource];
    savedRecord.current = null;
    const saved = await writeWithRecovery(api, port, context, signal, () =>
      record ? port.update(context, record.id, input, signal) : port.create(context, input, signal),
    );
    requireLease(api, context, signal);
    await invalidateResource(queryClient, context, resource);
    requireLease(api, context, signal);
    savedRecord.current = saved;
  }
  if (recovering)
    return (
      <section
        data-resource={resource}
        className="system-draft-recovery flex flex-wrap items-center gap-2 [&>p]:basis-full"
        aria-label={t('system.draftAvailable')}
      >
        <p>{t('system.draftAvailable')}</p>
        <Button
          type="button"
          onClick={() => {
            if (draft && typeof draft === 'object' && !Array.isArray(draft))
              schema.setValues(draft, { shouldDirty: true });
            setRecovering(false);
          }}
        >
          {t('system.restoreDraft')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            interaction.removeDraft(scopeKey, draftKey);
            setRecovering(false);
          }}
        >
          {t('system.discardDraft')}
        </Button>
      </section>
    );
  return (
    <div
      data-resource={resource}
      className="system-record-editor [&_.pattern-form-group]:rounded-none [&_.pattern-form-group]:border-0 [&_.pattern-form-group]:p-0 [&_.pattern-form-group>legend]:sr-only"
    >
      <FormFrame
        headerMode="external"
        form={schema.form}
        title={t(record ? 'system.editTitle' : 'system.createTitle', {
          resource: t(resourceConfig[resource].titleKey),
        })}
        headingLevel={2}
        draftKey={draftKey}
        scopeKey={scopeKey}
        onCancel={onCancel}
        onCancelReady={onCancelReady}
        formId={formId}
        draftFilter={filterDraft}
        reviewReady={writable}
        operationKey={JSON.stringify([schema.configVersion, state.generation, state.status, state.loginExpired])}
        onSubmit={submit}
        onSubmitted={() => {
          if (savedRecord.current) onSubmitted(savedRecord.current);
        }}
        submitLabel={t('common:save')}
        resolveSubmitError={error => systemErrorCopy(error, t)}
      >
        {!writable && <p role="status">{t('system.writeUnavailable')}</p>}
        <schema.Fields />
      </FormFrame>
    </div>
  );
}
