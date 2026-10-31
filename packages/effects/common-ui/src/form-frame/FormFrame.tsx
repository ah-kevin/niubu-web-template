import { useTranslation } from '@niubu/locales/react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  FormProvider,
  useFormContext,
  type DeepPartial,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { useInteractionState } from '@niubu/stores';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { FieldShell } from '../form/FieldShell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@niubu/shadcn-ui/alert-dialog';
import { UnsavedGuard } from '../unsaved-guard';
import { PageHeader } from '../page-header';
import { usePreviewServiceMode } from '../preview-service';
import { createOperationOwner, type OperationLease } from '../form/operation';
import { copyValue } from '../form/transforms';
import { focusFirstInvalidControl } from '../form/focus';
import { restoreOverlayFocus } from '../overlay/focus-restoration';

export type FormGroupDefinition<T extends FieldValues> = {
  label: string;
  fields: readonly FieldPath<T>[];
};

export type FormFrameProps<T extends FieldValues> = {
  form: UseFormReturn<T>;
  title: string;
  draftKey: string;
  scopeKey: string;
  onCancel: () => void;
  /** Offer an explicit draft-free exit. Existing callers preserve their two choices. */
  allowDiscard?: boolean;
  groups?: readonly FormGroupDefinition<T>[];
  children: ReactNode;
  review?: ReactNode;
  headingLevel?: 1 | 2;
  /** External containers provide the visible heading; the form keeps its accessible name. */
  headerMode?: 'visible' | 'external';
  /** Omit to keep default guidance, or pass null when no introduction is needed. */
  description?: string | null;
  reviewReady?: boolean;
  onCancelRequest?: () => void;
  onSubmit?: (values: T, context: { signal: AbortSignal }) => Promise<void>;
  onSubmitted?: () => void;
  operationKey?: unknown;
  draftFilter?: (values: T) => DeepPartial<T>;
  submitLabel?: string;
  formId?: string;
  onCancelReady?: (requestCancel: (() => void) | null) => void;
  resolveSubmitError?: (error: unknown) => ReactNode;
};

/** One validation/review/save owner. Omitting onSubmit preserves the historical preview. */
export function FormFrame<T extends FieldValues>(props: FormFrameProps<T>) {
  const {
    form,
    title,
    draftKey,
    scopeKey,
    onCancel,
    groups = [],
    children,
    review,
    headingLevel = 1,
    headerMode = 'visible',
    description,
    reviewReady = true,
    operationKey,
    draftFilter,
    onCancelReady,
    submitLabel,
    formId,
    onSubmit,
  } = props;
  const { t } = useTranslation();
  const service = usePreviewServiceMode();
  const { setDirty, writeDraft, removeDraft, runWithoutGuard } = useInteractionState();
  const instance = useId();
  const cancelOwner = useMemo(() => ({ form, scopeKey, draftKey }), [form, scopeKey, draftKey]);
  type CancelOwner = typeof cancelOwner;
  const draftOwner = useRef<CancelOwner | null>(null);
  const discardedBaseline = useRef<{ owner: CancelOwner; values: T } | null>(null);
  const formElement = useRef<HTMLFormElement>(null);
  const [operations] = useState(createOperationOwner);
  const generation = useRef(0);
  const focusedRequest = useRef(0);
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<{ target: HTMLElement; generation: number } | null>(null);
  const internalReset = useRef(false);
  const mounted = useRef(true);
  const snapshot = useRef<{ values: T; lease: OperationLease } | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  const [cancel, setCancel] = useState<CancelOwner | null>(null);
  const [discardNotification, setDiscardNotification] = useState<{ owner: CancelOwner; callback: () => void } | null>(
    null,
  );
  const deliveredDiscard = useRef<typeof discardNotification>(null);
  const [checked, setChecked] = useState(false);
  const [invalidRequest, setInvalidRequest] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [submitError, setSubmitError] = useState<ReactNode>(null);
  const [notification, setNotification] = useState<{ generation: number; callback?: () => void } | null>(null);
  const { isDirty, errors } = form.formState;
  const { watch, getValues, getFieldState, trigger } = form;
  const invalidate = useCallback(() => {
    generation.current++;
    returnFocus.current = null;
    operations.cancel();
    snapshot.current = null;
    saving.current = false;
    if (mounted.current) {
      setPending(false);
      setReviewOpen(false);
      setInvalidRequest(0);
      setSubmitError(null);
    }
  }, [operations]);
  useLayoutEffect(() => {
    mounted.current = true;
    const counter = generation;
    return () => {
      mounted.current = false;
      counter.current++;
      operations.cancel();
    };
  }, [operations]);
  useLayoutEffect(() => {
    invalidate();
  }, [operationKey, reviewReady, form, scopeKey, draftKey, invalidate]);
  useEffect(() => {
    if (!notification || notification.generation !== generation.current || !mounted.current) return;
    // The cleanup render is committed before the app closes or refreshes its editor.
    notification.callback?.();
  }, [notification]);
  useEffect(() => {
    if (!discardNotification || deliveredDiscard.current === discardNotification || !mounted.current) return;
    const owner = discardNotification.owner,
      current = latest.current;
    // Consume even a retired owner’s notification; descriptor values may later return to A.
    deliveredDiscard.current = discardNotification;
    setDiscardNotification(null);
    if (
      owner !== cancelOwner ||
      owner.form !== current.form ||
      owner.scopeKey !== current.scopeKey ||
      owner.draftKey !== current.draftKey
    )
      return;
    discardNotification.callback();
  }, [discardNotification, cancelOwner]);
  useEffect(() => {
    setDirty(instance, isDirty);
    if (isDirty) {
      draftOwner.current = cancelOwner;
      writeDraft(scopeKey, draftKey, draftFilter ? draftFilter(getValues()) : getValues());
    } else if (!latest.current.allowDiscard || draftOwner.current === cancelOwner) removeDraft(scopeKey, draftKey);
    return () => setDirty(instance, false);
  }, [instance, isDirty, setDirty, writeDraft, removeDraft, scopeKey, draftKey, getValues, draftFilter, cancelOwner]);
  useEffect(() => {
    const subscription = watch(() => {
      if (internalReset.current) return;
      const active = latest.current;
      if (active.form !== form || active.scopeKey !== scopeKey || active.draftKey !== draftKey) return;
      invalidate();
      // RHF notifies watch before its dirty render; always filter the current snapshot.
      const current = getValues();
      if (
        discardedBaseline.current?.owner === cancelOwner &&
        sameFormValues(current, discardedBaseline.current.values)
      ) {
        removeDraft(scopeKey, draftKey);
        return;
      }
      discardedBaseline.current = null;
      draftOwner.current = cancelOwner;
      writeDraft(scopeKey, draftKey, latest.current.draftFilter ? latest.current.draftFilter(current) : current);
    });
    return () => subscription.unsubscribe();
  }, [watch, getValues, writeDraft, removeDraft, scopeKey, draftKey, invalidate, cancelOwner, form]);
  useEffect(() => {
    if (invalidRequest === 0 || invalidRequest !== generation.current || focusedRequest.current === invalidRequest)
      return;
    focusedRequest.current = invalidRequest;
    if (formElement.current) focusFirstInvalidControl(formElement.current, getFieldState);
  }, [invalidRequest, getFieldState]);
  const requestCancel = useCallback(() => {
    latest.current.onCancelRequest?.();
    invalidate();
    if (latest.current.form.formState.isDirty) setCancel(cancelOwner);
    else latest.current.onCancel();
  }, [invalidate, cancelOwner]);
  useLayoutEffect(() => {
    onCancelReady?.(requestCancel);
    return () => onCancelReady?.(null);
  }, [onCancelReady, requestCancel]);
  const hasErrors = Object.keys(errors).length > 0;
  const errorGroups = groups.filter(group => group.fields.some(field => getFieldState(field).invalid));
  function preserveAndLeave() {
    const values = getValues();
    writeDraft(scopeKey, draftKey, draftFilter ? draftFilter(values) : values);
    setCancel(null);
    runWithoutGuard(onCancel);
  }
  function discardAndLeave() {
    invalidate();
    internalReset.current = true;
    try {
      form.reset();
    } finally {
      internalReset.current = false;
    }
    discardedBaseline.current = { owner: cancelOwner, values: copyValue(getValues()) };
    removeDraft(scopeKey, draftKey);
    draftOwner.current = null;
    setDirty(instance, false);
    setCancel(null);
    // A reset may change submission readiness/keys; cancellation belongs to this form owner.
    setDiscardNotification({ owner: cancelOwner, callback: () => runWithoutGuard(onCancel) });
  }
  async function reviewInputs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewReady || saving.current) return;
    invalidate();
    const request = generation.current;
    const lease = operations.begin();
    setChecked(true);
    try {
      const valid = await trigger(undefined, { shouldFocus: false });
      if (!lease.current() || !mounted.current || !formElement.current?.isConnected) return;
      if (valid) {
        snapshot.current = { values: copyValue(getValues()), lease };
        setReviewOpen(true);
      } else {
        operations.complete(lease);
        setInvalidRequest(request);
      }
    } catch {
      if (!lease.current() || !mounted.current) return;
      operations.complete(lease);
      setSubmitError(t('common:saveFailed'));
    }
  }
  async function confirmSave() {
    const captured = snapshot.current;
    if (!onSubmit || !reviewReady || !captured?.lease.current() || saving.current) return;
    saving.current = true;
    setPending(true);
    setSubmitError(null);
    const callback = props.onSubmitted;
    try {
      await onSubmit(copyValue(captured.values), { signal: captured.lease.signal });
      if (!mounted.current || !captured.lease.current() || !operations.complete(captured.lease)) return;
      // Retire the operation before resetting. Its own watch event cannot cancel its success.
      snapshot.current = null;
      internalReset.current = true;
      try {
        form.reset(copyValue(captured.values));
      } finally {
        internalReset.current = false;
      }
      removeDraft(scopeKey, draftKey);
      setDirty(instance, false);
      saving.current = false;
      setPending(false);
      setReviewOpen(false);
      setReviewed(true);
      if (reviewTrigger.current)
        returnFocus.current = { target: reviewTrigger.current, generation: generation.current };
      setNotification({ generation: generation.current, callback });
    } catch (error) {
      if (!mounted.current || !captured.lease.current()) return;
      saving.current = false;
      setPending(false);
      let presentation: ReactNode;
      try {
        presentation = props.resolveSubmitError?.(error);
      } catch {
        /* Failed presentation falls back to generic copy. */
      }
      setSubmitError(presentation ?? t('common:saveFailed'));
    }
  }
  function changeReview(open: boolean) {
    if (!open) {
      invalidate();
      if (reviewTrigger.current)
        returnFocus.current = { target: reviewTrigger.current, generation: generation.current };
    } else setReviewOpen(true);
  }
  return (
    <FormProvider {...form}>
      <form
        ref={formElement}
        id={formId}
        aria-label={headerMode === 'external' ? title : undefined}
        className="pattern-form-frame min-w-0 max-w-full"
        noValidate
        onSubmit={reviewInputs}
      >
        {headerMode === 'visible' && (
          <PageHeader
            headingLevel={headingLevel}
            title={title}
            description={
              description === undefined
                ? t(onSubmit ? 'common:form.liveDescription' : 'common:form.description')
                : (description ?? undefined)
            }
          />
        )}
        {hasErrors && checked && (
          <div
            className="pattern-form-error-summary mb-[var(--workspace-section-gap)] rounded-[var(--radius)] border border-destructive border-l-[3px] bg-card p-[var(--workspace-card-padding)] text-[length:var(--workspace-caption-font-size)] leading-[1.8] text-destructive [&_ul]:mt-[8px] [&_ul]:pl-[18px]"
            role="alert"
          >
            <strong>{t('common:form.fixErrors')}</strong>
            <ul>
              {errorGroups.length ? (
                errorGroups.map(group => (
                  <li key={group.label}>{t('common:form.groupError', { label: group.label })}</li>
                ))
              ) : (
                <li>{t('common:form.checkFields')}</li>
              )}
            </ul>
          </div>
        )}
        <div className="pattern-form-content grid gap-[var(--workspace-section-gap)]">{children}</div>
        <footer className="pattern-form-actions mt-[var(--workspace-section-gap)] flex flex-wrap items-center justify-between gap-[14px] border-t border-border pt-[var(--workspace-card-padding)] [@media(max-width:700px)]:items-start [&>p]:text-[length:var(--workspace-caption-font-size)] [&>p]:text-muted-foreground [&>div]:flex [&>div]:flex-wrap [&>div]:gap-[8px] [@media(max-width:700px)]:[&>div]:w-full [@media(max-width:700px)]:[&>div]:justify-end">
          <p>{isDirty ? t('common:form.dirty') : t('common:form.clean')}</p>
          <div>
            <Button type="button" variant="outline" onClick={requestCancel}>
              {t('common:cancel')}
            </Button>
            <Button ref={reviewTrigger} type="submit" disabled={!reviewReady || pending}>
              {submitLabel ?? t(onSubmit ? 'common:save' : 'common:checkContinue')}
            </Button>
          </div>
        </footer>
        {reviewed && (
          <div
            className="submission-state mt-[17px] flex items-start gap-[10px] rounded-[var(--radius)] bg-secondary p-[14px] text-[length:var(--workspace-caption-font-size)] leading-[1.8] text-[var(--primary-text)] [&_p]:text-[length:var(--workspace-caption-font-size)] [&_p]:text-[var(--secondary-muted-foreground)]"
            role="status"
            aria-label={t('common:form.submissionStatus')}
          >
            <div>
              <strong>
                {t(
                  onSubmit
                    ? 'common:form.liveSaved'
                    : service === 'disabled'
                      ? 'common:notSubmitted'
                      : 'common:previewNotSubmitted',
                )}
              </strong>
              {!onSubmit && <p>{t('common:form.retained')}</p>}
            </div>
          </div>
        )}
        {submitError && !reviewOpen && <div role="alert">{submitError}</div>}
      </form>
      <UnsavedGuard
        open={cancel === cancelOwner}
        onStay={() => setCancel(null)}
        onLeave={preserveAndLeave}
        onDiscard={props.allowDiscard ? discardAndLeave : undefined}
        description={
          props.allowDiscard ? t('common:form.dirty') : onSubmit ? t('common:guard.livePreserveDescription') : undefined
        }
      />
      <AlertDialog open={reviewOpen} onOpenChange={changeReview}>
        {reviewOpen && (
          <AlertDialogContent
            className="pattern-action-dialog min-w-0 max-h-[calc(100dvh-32px)]"
            onCloseAutoFocus={event => {
              event.preventDefault();
              const focus = returnFocus.current;
              returnFocus.current = null;
              if (mounted.current && focus?.generation === generation.current && focus.target.isConnected)
                restoreOverlayFocus(focus.target, event.target);
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(onSubmit ? 'common:form.liveReviewTitle' : 'common:form.reviewTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(onSubmit ? 'common:form.liveReviewDescription' : 'common:form.reviewDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="pattern-review-content min-h-0 min-w-0 flex-1 overflow-y-auto rounded-[var(--radius)] border border-border bg-secondary p-[14px] text-[length:var(--workspace-caption-font-size)] leading-[1.8] [--muted-foreground:var(--secondary-muted-foreground)] [overflow-wrap:anywhere]">
              {review ?? <p>{t(onSubmit ? 'common:form.liveReviewPassed' : 'common:form.reviewPassed')}</p>}
            </div>
            {submitError && <div role="alert">{submitError}</div>}
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:backToEdit')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending || !reviewReady}
                onClick={event => {
                  if (onSubmit) {
                    event.preventDefault();
                    void confirmSave();
                  } else setReviewed(true);
                }}
              >
                {t(onSubmit ? (pending ? 'common:saving' : 'common:confirmSave') : 'common:confirmPreview')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </FormProvider>
  );
}

export function FormGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="pattern-form-group m-0 min-w-0 rounded-[var(--radius)] border border-border bg-card p-[var(--workspace-card-padding)]">
      <legend className="px-[8px] text-base font-semibold">{title}</legend>
      {description && (
        <p className="pattern-description text-[length:var(--workspace-caption-font-size)] leading-[1.8] text-muted-foreground">
          {description}
        </p>
      )}
      <div className="pattern-field-grid mt-[8px] grid grid-cols-2 gap-[var(--workspace-section-gap)] [@media(max-width:700px)]:grid-cols-1 [@media(max-width:700px)]:gap-[var(--workspace-heading-gap)]">
        {children}
      </div>
    </fieldset>
  );
}

type FormFieldProps = {
  name: string;
  label: string;
  type?: string;
  description?: string;
  unit?: string;
  required?: boolean;
  resolveMessage?: (message: string) => string;
};
/** Simple string inputs. Numeric and complex controls remain domain-owned registered children. */

export function FormField({ name, label, type = 'text', description, unit, required, resolveMessage }: FormFieldProps) {
  const { t } = useTranslation();
  const { register, getFieldState, formState } = useFormContext();
  const id = useId();
  const error = getFieldState(name, formState).error;
  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      unit={unit}
      required={required}
      error={error ? String(error.message ?? t('validation:checkField')) : undefined}
      resolveMessage={resolveMessage}
    >
      {accessibility => <Input {...register(name)} {...accessibility} aria-label={label} type={type} />}
    </FieldShell>
  );
}

/** Reset-driven dependent notifications must not resurrect a discarded baseline as a draft. */
function sameFormValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && sameFormValues(Reflect.get(left, key), Reflect.get(right, key)))
  );
}
