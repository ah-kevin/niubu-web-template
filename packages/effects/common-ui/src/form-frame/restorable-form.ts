import { useEffect, useState } from 'react';
import { useForm, type DeepPartial, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useInteractionState } from '@niubu/stores';

/** Mount a new instance (key it by scope/draft identity) when either identity changes. */

export function useRestorableForm<T extends FieldValues>({
  schema,
  defaultValues,
  scopeKey,
  draftKey,
  draftFilter,
}: {
  schema: z.ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  scopeKey: string;
  draftKey: string;
  draftFilter?: (values: T) => DeepPartial<T>;
}) {
  const state = useInteractionState();
  const [draft] = useState(() => {
    const stored = state.readDraft(scopeKey, draftKey);
    return stored !== undefined && draftFilter ? draftFilter(stored as T) : stored;
  });
  const form = useForm<T>({
    defaultValues,
    resolver: zodResolver(schema) as Resolver<T>,
    mode: 'onSubmit',
    shouldFocusError: true,
  });
  const { reset } = form;
  useEffect(() => {
    if (draft !== undefined) reset(draft as T, { keepDefaultValues: true });
  }, [draft, reset]);
  return form;
}
