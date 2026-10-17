import { useState, type CSSProperties } from 'react';
import {
  ControlledField,
  type CustomFieldParams,
  type CustomFieldRegistry,
  type FormFieldConfig,
  type FormLayout,
  type SchemaFormApi,
  type SchemaFieldsProps,
} from '@niubu/common-ui/form';
import { Button } from '@niubu/shadcn-ui/button';
import { useTranslation } from '@niubu/locales/react';
import { formsExampleEnglish, useFormsText } from './copy';

export function ExampleFields<V extends Record<string, unknown>, C extends CustomFieldParams = CustomFieldParams>({
  form,
  fields,
  names,
  layout,
  customFields,
}: {
  form: SchemaFormApi<V>['form'];
  fields: readonly FormFieldConfig<V, C>[];
  names?: SchemaFieldsProps<V>['names'];
  layout?: FormLayout;
  customFields?: CustomFieldRegistry<V, C>;
}) {
  const text = useFormsText();
  const { t } = useTranslation();
  function translate(key: string) {
    const localKey = key.replace(/^app:examples\.forms\./, '');
    return Object.hasOwn(formsExampleEnglish, localKey) ? text(localKey as keyof typeof formsExampleEnglish) : t(key);
  }
  // watch is the existing owner's public subscription; no second form or resolver.
  const values = form.watch();
  const visible = fields.flatMap(field => {
    const derived = field.dependencies?.derive(values);
    if (derived?.visible === false || (names && !names.includes(field.name))) return [];
    return [{ ...field, ...derived, componentProps: { ...field.componentProps, ...derived?.componentProps } }];
  });
  const columns = layout?.columns ?? 1;
  const limit = layout?.collapsedRows === undefined ? Infinity : layout.collapsedRows * columns;
  const [expanded, setExpanded] = useState(false);
  const collapsedError = visible.some((field, index) => index >= limit && form.getFieldState(field.name).invalid);
  if (collapsedError && !expanded) setExpanded(true);
  const style = { '--schema-columns': columns } as CSSProperties;
  return (
    <div className="pattern-schema-fields" data-label-layout="top" style={style}>
      <div className="pattern-field-grid pattern-schema-grid" style={style}>
        {visible.map((field, index) => {
          const localized = {
            ...field,
            label: translate(field.label),
            description: field.description ? translate(field.description) : undefined,
            componentProps: {
              ...field.componentProps,
              ...('options' in field.componentProps && Array.isArray(field.componentProps.options)
                ? {
                    options: field.componentProps.options.map(
                      (option: { value: string; label: string; disabled?: boolean }) => ({
                        ...option,
                        label: translate(option.label),
                      }),
                    ),
                  }
                : {}),
            },
          } as FormFieldConfig<V, C>;
          return (
            <div
              key={field.name}
              data-schema-field={field.name}
              className="pattern-schema-cell"
              hidden={index >= limit && !expanded && !collapsedError}
              style={{ '--schema-col-span': Math.min(columns, field.colSpan ?? 1) } as CSSProperties}
            >
              <ControlledField
                {...localized}
                control={form.control}
                customFields={customFields}
                resolveMessage={translate}
              />
            </div>
          );
        })}
      </div>
      {visible.length > limit && (
        <Button
          type="button"
          variant="outline"
          aria-expanded={expanded || collapsedError}
          onClick={() => setExpanded(!expanded)}
        >
          {t(expanded || collapsedError ? 'common:collapse' : 'common:expand')}
        </Button>
      )}
    </div>
  );
}
