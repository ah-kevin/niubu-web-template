import type { KeyboardEvent } from 'react';
import { FormProvider, type FieldValues } from 'react-hook-form';
import { Button } from '@niubu/shadcn-ui/button';
import { useTranslation } from '@niubu/locales/react';
import { SchemaFields } from './SchemaFields';
import type { CustomFieldParams } from './types';
import type { SchemaFormProps, SchemaRenderModel } from './schema-types';

export function SchemaForm<V extends FieldValues, C extends CustomFieldParams>({
  model,
  id,
  className,
  children,
  submitLabel,
  resetLabel,
  showActions = true,
}: SchemaFormProps & { model: SchemaRenderModel<V, C> }) {
  const { t } = useTranslation();
  function keyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter') return;
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      event.preventDefault();
      return;
    }
    if (
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    )
      return;
    if (
      event.target instanceof HTMLButtonElement ||
      (event.target instanceof HTMLElement && event.target.closest('[role="combobox"], [role="listbox"]'))
    )
      return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
  return (
    <FormProvider {...model.form}>
      <form
        id={id}
        className={className ?? 'pattern-schema-form'}
        noValidate
        onKeyDown={keyDown}
        onSubmit={event => {
          event.preventDefault();
          void model.submit();
        }}
        onReset={event => {
          event.preventDefault();
          model.reset();
        }}
      >
        {children ?? <SchemaFields model={model} />}
        {showActions && (
          <div className="pattern-form-actions mt-[var(--workspace-section-gap)] flex flex-wrap items-center justify-between gap-[14px] border-t border-border pt-[var(--workspace-card-padding)] [@media(max-width:700px)]:items-start [&>p]:text-[length:var(--workspace-caption-font-size)] [&>p]:text-muted-foreground [&>div]:flex [&>div]:flex-wrap [&>div]:gap-[8px] [@media(max-width:700px)]:[&>div]:w-full [@media(max-width:700px)]:[&>div]:justify-end">
            <Button type="submit">{submitLabel ?? t('common:submit')}</Button>
            <Button type="reset" variant="outline">
              {resetLabel ?? t('common:reset')}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
