import { useTranslation } from '@niubu/locales/react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
import { Label } from '@niubu/shadcn-ui/label';
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
  groups?: readonly FormGroupDefinition<T>[];
  children: ReactNode;
  review?: ReactNode;
  headingLevel?: 1 | 2;
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
  const [cancel, setCancel] = useState(false);
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
    setDirty(instance, isDirty);
    if (isDirty) writeDraft(scopeKey, draftKey, draftFilter ? draftFilter(getValues()) : getValues());
    else removeDraft(scopeKey, draftKey);
    return () => setDirty(instance, false);
  }, [instance, isDirty, setDirty, writeDraft, removeDraft, scopeKey, draftKey, getValues, draftFilter]);
  useEffect(() => {
    const subscription = watch(() => {
      if (internalReset.current) return;
      invalidate();
      // RHF notifies watch before its dirty render; always filter the current snapshot.
      const current = getValues();
      writeDraft(scopeKey, draftKey, latest.current.draftFilter ? latest.current.draftFilter(current) : current);
    });
    return () => subscription.unsubscribe();
  }, [watch, getValues, writeDraft, scopeKey, draftKey, invalidate]);
  useEffect(() => {
    if (invalidRequest === 0 || invalidRequest !== generation.current || focusedRequest.current === invalidRequest)
      return;
    focusedRequest.current = invalidRequest;
    if (formElement.current) focusFirstInvalidControl(formElement.current, getFieldState);
  }, [invalidRequest, getFieldState]);
  const requestCancel = useCallback(() => {
    latest.current.onCancelRequest?.();
    invalidate();
    if (latest.current.form.formState.isDirty) setCancel(true);
    else latest.current.onCancel();
  }, [invalidate]);
  useLayoutEffect(() => {
    onCancelReady?.(requestCancel);
    return () => onCancelReady?.(null);
  }, [onCancelReady, requestCancel]);
  const hasErrors = Object.keys(errors).length > 0;
  const errorGroups = groups.filter(group => group.fields.some(field => getFieldState(field).invalid));
  function preserveAndLeave() {
    const values = getValues();
    writeDraft(scopeKey, draftKey, draftFilter ? draftFilter(values) : values);
    setCancel(false);
    runWithoutGuard(onCancel);
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
      <form ref={formElement} id={formId} className="pattern-form-frame" noValidate onSubmit={reviewInputs}>
        <PageHeader
          headingLevel={headingLevel}
          title={title}
          description={t(onSubmit ? 'common:form.liveDescription' : 'common:form.description')}
        />
        {hasErrors && checked && (
          <div className="pattern-form-error-summary" role="alert">
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
        <div className="pattern-form-content">{children}</div>
        <footer className="pattern-form-actions">
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
          <div className="submission-state" role="status" aria-label={t('common:form.submissionStatus')}>
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
        open={cancel}
        onStay={() => setCancel(false)}
        onLeave={preserveAndLeave}
        description={onSubmit ? t('common:guard.livePreserveDescription') : undefined}
      />
      <AlertDialog open={reviewOpen} onOpenChange={changeReview}>
        {reviewOpen && (
          <AlertDialogContent
            className="pattern-action-dialog"
            onCloseAutoFocus={event => {
              event.preventDefault();
              const focus = returnFocus.current;
              returnFocus.current = null;
              if (mounted.current && focus?.generation === generation.current && focus.target.isConnected)
                focus.target.focus();
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
            <div className="pattern-review-content">
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
    <fieldset className="pattern-form-group">
      <legend>{title}</legend>
      {description && <p className="pattern-description">{description}</p>}
      <div className="pattern-field-grid">{children}</div>
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
  const help = description ? `${id}-help` : '';
  const errorId = error ? `${id}-error` : '';
  return (
    <div className="pattern-form-field">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {unit && <span className="pattern-unit">{unit}</span>}
      </Label>
      <Input
        id={id}
        aria-label={label}
        type={type}
        {...register(name)}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={[help, errorId].filter(Boolean).join(' ') || undefined}
      />
      {description && (
        <p id={help} className="pattern-field-help">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {resolveMessage
            ? resolveMessage(String(error.message ?? t('validation:checkField')))
            : String(error.message ?? t('validation:checkField'))}
        </p>
      )}
    </div>
  );
}
