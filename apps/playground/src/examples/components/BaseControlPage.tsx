import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useSchemaForm } from '@niubu/common-ui/form';
import { Button } from '@niubu/shadcn-ui/button';
import { ExamplePage, ExampleSection } from '../ExamplePage';
import { ControlGallery } from './ControlGallery';
import { controlGalleryTitles, type BaseControlKind } from './control-kinds';
import { useComponentsText } from './copy';

export type { BaseControlKind } from './control-kinds';

/** The route owner chooses one component; no registry or route is created here. */
export function BaseControlPage({ kind }: { kind: BaseControlKind }) {
  const { t } = useComponentsText();
  return (
    <ExamplePage title={kind === 'FormField' ? t('formFieldTitle') : t(controlGalleryTitles[kind])}>
      {kind === 'FormField' ? <FormFieldExample /> : <ControlGallery key={kind} only={kind} />}
    </ExamplePage>
  );
}

function FormFieldExample() {
  const { t } = useComponentsText();
  const [disabled, setDisabled] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const nameLabel = t('formFieldName');
  const nameDescription = t('formFieldDescription');
  const nameRequired = t('formFieldRequired');
  const emailLabel = t('formFieldEmail');
  const emailInvalid = t('formFieldInvalidEmail');
  const fields = useMemo(
    () => [
      {
        name: 'name' as const,
        kind: 'text' as const,
        label: nameLabel,
        description: nameDescription,
        required: true,
        disabled,
        schema: z.string().min(1, nameRequired),
      },
      {
        name: 'email' as const,
        kind: 'text' as const,
        label: emailLabel,
        required: true,
        disabled,
        schema: z.email(emailInvalid),
      },
    ],
    [disabled, nameLabel, nameDescription, nameRequired, emailLabel, emailInvalid],
  );
  const schema = useSchemaForm<{ name: string; email: string }>({
    defaultValues: { name: '', email: '' },
    fields,
    onSubmit: async values => {
      setSubmitted(values.name ?? '');
    },
  });
  const { updateFields } = schema;
  useEffect(() => updateFields(fields), [fields, updateFields]);
  return (
    <ExampleSection title={t('formFieldTitle')} description={t('formFieldHelp')}>
      <Button
        type="button"
        variant="outline"
        aria-pressed={disabled}
        onClick={() => {
          setDisabled(value => !value);
        }}
      >
        {t('disabledState')}
      </Button>
      <schema.Form submitLabel={t('formFieldSave')} resetLabel={t('formFieldReset')} />
      <output aria-live="polite">
        {submitted === null ? t('formFieldNoResult') : t('formFieldSaved', { name: submitted })}
      </output>
    </ExampleSection>
  );
}
