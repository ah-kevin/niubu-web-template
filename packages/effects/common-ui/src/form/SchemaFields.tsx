import { useState, type CSSProperties } from 'react';
import { get, useFormState, useWatch, type FieldValues } from 'react-hook-form';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { ControlledField } from './ControlledField';
import { resolveFields } from './validation';
import type { CustomFieldParams } from './types';
import type { SchemaFieldsProps, SchemaRenderModel } from './schema-types';

/** Fields only: composes into either the hook's Form or an existing FormFrame owner. */
export function SchemaFields<V extends FieldValues, C extends CustomFieldParams>({
  model,
  names,
  className,
}: SchemaFieldsProps<V> & { model: SchemaRenderModel<V, C> }) {
  const { t } = useTranslation();
  useWatch({ control: model.form.control });
  const { errors } = useFormState({ control: model.form.control });
  const [expanded, setExpanded] = useState(false);
  const fields = resolveFields(model.fields, model.form.getValues()).filter(
    field => field.visible && (!names || names.includes(field.name)),
  );
  const columns = Math.max(1, model.layout?.columns ?? 1);
  const limit =
    model.layout?.collapsedRows === undefined ? Infinity : Math.max(0, model.layout.collapsedRows) * columns;
  const placement = fields.reduce(
    (previous, field) => {
      const span = Math.min(columns, Math.max(1, field.colSpan ?? 1));
      const remainder = previous.occupied % columns;
      const start = remainder + span > columns ? previous.occupied + columns - remainder : previous.occupied;
      return { occupied: start + span, rows: [...previous.rows, { field, collapsed: start >= limit }] };
    },
    { occupied: 0, rows: [] as { field: (typeof fields)[number]; collapsed: boolean }[] },
  );
  const { rows, occupied } = placement;
  const collapsedErrors = rows.some(({ field, collapsed }) => collapsed && !!get(errors, field.name));
  if (collapsedErrors && !expanded) setExpanded(true);
  const showAll = expanded || collapsedErrors;
  function fieldNode({ field, collapsed }: (typeof rows)[number]) {
    return (
      <div
        key={field.name}
        className="pattern-schema-cell min-w-0"
        hidden={collapsed && !showAll}
        data-schema-field={field.name}
        style={{ '--schema-col-span': Math.min(columns, Math.max(1, field.colSpan ?? 1)) } as CSSProperties}
      >
        <ControlledField<V, typeof field.name, C>
          {...field}
          control={model.form.control}
          customFields={model.customFields}
          resolveMessage={
            field.resolveMessage ?? (message => (message.startsWith('validation:') ? t(message) : message))
          }
        />
      </div>
    );
  }
  const groups = model.groups ?? [];
  const style = {
    '--schema-columns': columns,
    '--schema-label-width':
      typeof model.layout?.labelWidth === 'number' ? `${model.layout.labelWidth}px` : model.layout?.labelWidth,
  } as CSSProperties;
  const ungrouped = rows.filter(({ field }) => !field.group || !groups.some(group => group.id === field.group));
  return (
    <div
      className={['pattern-schema-fields', className].filter(Boolean).join(' ')}
      data-label-layout={(model.layout?.labelWidth ?? 'auto') === 'auto' ? 'top' : 'inline'}
      style={style}
    >
      {ungrouped.length > 0 && (
        <div
          className="pattern-field-grid pattern-schema-grid mt-[8px] grid grid-cols-2 gap-[var(--workspace-section-gap)] [@media(max-width:700px)]:grid-cols-1 [@media(max-width:700px)]:gap-[var(--workspace-heading-gap)]"
          style={style}
        >
          {ungrouped.map(fieldNode)}
        </div>
      )}
      {groups.map(group => {
        const grouped = rows.filter(({ field }) => field.group === group.id);
        return (
          grouped.length > 0 && (
            <fieldset
              key={group.id}
              className="pattern-form-group m-0 min-w-0 rounded-[var(--radius)] border border-border bg-card p-[var(--workspace-card-padding)]"
            >
              <legend className="px-[8px] text-base font-semibold">{group.title}</legend>
              {group.description && <p>{group.description}</p>}
              <div
                className="pattern-field-grid pattern-schema-grid mt-[8px] grid grid-cols-2 gap-[var(--workspace-section-gap)] [@media(max-width:700px)]:grid-cols-1 [@media(max-width:700px)]:gap-[var(--workspace-heading-gap)]"
                style={style}
              >
                {grouped.map(fieldNode)}
              </div>
            </fieldset>
          )
        );
      })}
      {occupied > limit && (
        <Button type="button" variant="outline" aria-expanded={showAll} onClick={() => setExpanded(!showAll)}>
          {t(showAll ? 'common:collapse' : 'common:expand')}
        </Button>
      )}
    </div>
  );
}
