import { useLayoutEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { type CustomFieldRegistry, type FormFieldConfig } from '@niubu/common-ui/form';
import { useQueryDataTable } from '@niubu/common-ui/data-table';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { useTranslation } from '@niubu/locales/react';
import { useFormsText } from './copy';
import { ExampleFields } from './live-fields';
import { useExampleForm } from './use-example-form';
import { DocumentationLink } from '../DocumentationLink';
import { ExamplePage, ExampleSection } from '../ExamplePage';

type NameValues = { name: string };
const cases = [
  ['E43', 'api', ApiPanel],
  ['E44', 'builtin', BuiltinPanel],
  ['E46', 'layout', LayoutPanel],
  ['E47', 'custom', CustomPanel],
  ['E48', 'derive', DerivedPanel],
  ['E51', 'query', QueryPanel],
  ['E52', 'rules', RulesPanel],
  ['E53', 'focus', FocusPanel],
  ['E54', 'format', FormatPanel],
] as const;

export type FormsPageProps = {
  saveName?: (name: string, context: { signal: AbortSignal }) => Promise<void>;
};
export function FormsPage({ saveName }: FormsPageProps = {}): React.JSX.Element {
  const text = useFormsText();
  const [selected, setSelected] = useState<string>('E44');
  const active = cases.find(([id]) => id === selected) ?? cases[0];
  const Panel = active[2];
  return (
    <ExamplePage title={text('title')} description={text('introduction')} actions={<DocumentationLink kind="forms" />}>
      <nav
        aria-label={text('title')}
        className="flex min-w-0 flex-wrap items-center gap-x-1 rounded-[var(--radius)] border border-border bg-card px-3"
      >
        {cases.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            className={`rounded-none border-b-2 px-3 ${selected === id ? 'border-primary text-primary-text' : 'border-transparent text-muted-foreground'}`}
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
          >
            {text(label)}
          </Button>
        ))}
      </nav>
      <ExampleSection
        title={text(active[1])}
        bodyClassName={
          active[0] === 'E44' || active[0] === 'E46' ? 'sm:p-6' : 'sm:p-6 [&_form]:max-w-xl [&>div]:max-w-3xl'
        }
      >
        {active[0] === 'E43' ? <ApiPanel saveName={saveName} /> : <Panel key={active[0]} />}
      </ExampleSection>
    </ExamplePage>
  );
}

function ApiPanel({ saveName }: FormsPageProps = {}) {
  const text = useFormsText();
  const [current, setCurrent] = useState('—');
  const [locked, setLocked] = useState(false);
  const [submitted, setSubmitted] = useState('—');
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid' | 'pending' | 'cancelled' | 'submitted' | 'error'>(
    'idle',
  );
  const [finish, setFinish] = useState<(() => void) | null>(null);
  const alive = useRef(true);
  const pending = useRef<(() => void) | null>(null);
  const schema = useExampleForm<NameValues>({
    fields: [
      {
        name: 'name',
        label: locked ? 'lockedName' : 'name',
        disabled: locked,
        kind: 'text',
        schema: z.string().trim().min(2, 'app:examples.forms.nameError'),
      },
    ],
    defaultValues: { name: 'Ada' },
    onSubmit: async (values, { signal }) => {
      if (saveName) {
        setStatus('pending');
        await saveName(values.name ?? '', { signal });
        if (!signal.aborted && alive.current) setSubmitted(values.name ?? '—');
        return;
      }
      let release!: () => void;
      const completion = new Promise<void>(resolve => {
        release = resolve;
      });
      pending.current = release;
      setFinish(() => release);
      setStatus('pending');
      await completion;
      if (alive.current && pending.current === release) {
        pending.current = null;
        setFinish(null);
      }
      if (!signal.aborted && alive.current) setSubmitted(values.name ?? '—');
    },
  });
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current?.();
      pending.current = null;
    };
  }, []);
  async function submit() {
    const result = await schema.submit();
    if (alive.current) setStatus(result === 'validated' ? 'valid' : result);
  }
  return (
    <>
      <p className="text-sm leading-relaxed text-muted-foreground">{text('apiHelp')}</p>
      <schema.Form showActions={false}>
        <ExampleFields form={schema.form} {...schema.presentation} />
      </schema.Form>
      <div className="flex flex-wrap items-center justify-start gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => schema.setValues({ name: 'Grace' }, { shouldDirty: true })}
        >
          {text('set')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrent(schema.publicValues(schema.getValues()).name ?? '—')}
        >
          {text('read')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            schema.updateFields([{ name: 'name', label: 'lockedName', disabled: true }]);
            setLocked(true);
          }}
        >
          {text('patch')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            schema.cancel();
            schema.form.reset();
          }}
        >
          {text('reset')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void schema.validate().then(result => {
              if (alive.current) setStatus(result.valid ? 'valid' : 'invalid');
            });
          }}
        >
          {text('validate')}
        </Button>
        <Button
          type="button"
          disabled={status === 'pending' || finish !== null}
          onClick={() => {
            void submit();
          }}
        >
          {text('submit')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            schema.cancel();
            setStatus('cancelled');
          }}
        >
          {text('cancel')}
        </Button>
        {finish && (
          <Button type="button" variant="outline" onClick={finish}>
            {text('finish')}
          </Button>
        )}
      </div>
      <p>
        {text('currentName')}: <output aria-label={text('currentName')}>{current}</output>
      </p>
      <p>
        {text('submittedName')}: <output aria-label={text('submittedName')}>{submitted}</output>
      </p>
      <p>
        {text('operationStatus')}: <output aria-label={text('operationStatus')}>{text(status)}</output>
      </p>
    </>
  );
}

type BuiltinValues = {
  name: string;
  notes: string;
  quantity: number | null;
  password: string;
  category: string;
  accepted: boolean;
  channels: string[];
  delivery: string;
  enabled: boolean;
  date: string;
  range: { start: string; end: string };
};
function BuiltinPanel() {
  const text = useFormsText();
  const [preview, setPreview] = useState('—');
  const fields: FormFieldConfig<BuiltinValues>[] = [
    { name: 'name', label: 'name', kind: 'text' },
    { name: 'notes', label: 'notes', kind: 'textarea', colSpan: 2 },
    { name: 'quantity', label: 'quantity', kind: 'number' },
    { name: 'password', label: 'password', description: 'passwordHelp', kind: 'password' },
    {
      name: 'category',
      label: 'category',
      kind: 'select',
      componentProps: {
        options: [
          { value: 'general', label: 'general' },
          { value: 'research', label: 'research' },
        ],
      },
    },
    { name: 'accepted', label: 'accepted', kind: 'checkbox' },
    {
      name: 'channels',
      label: 'channels',
      kind: 'checkbox-group',
      componentProps: {
        options: [
          { value: 'email', label: 'email' },
          { value: 'sms', label: 'sms' },
        ],
      },
    },
    {
      name: 'delivery',
      label: 'delivery',
      kind: 'radio',
      componentProps: {
        className: 'flex min-h-[var(--workspace-control-height)] flex-wrap items-center gap-x-4 gap-y-2',
        options: [
          { value: 'standard', label: 'standard' },
          { value: 'express', label: 'express' },
        ],
      },
    },
    { name: 'enabled', label: 'enabled', kind: 'switch' },
    { name: 'date', label: 'date', kind: 'date' },
    { name: 'range', label: 'range', kind: 'date-range', colSpan: 2 },
  ];
  const schema = useExampleForm<BuiltinValues>({
    fields,
    defaultValues: { category: 'general', delivery: 'standard' },
    layout: { columns: 3, labelWidth: 80 },
  });
  function readPublicFields() {
    const values = schema.publicValues(schema.getValues());
    setPreview(
      JSON.stringify({
        name: values.name,
        notes: values.notes,
        quantity: values.quantity,
        category: values.category,
        accepted: values.accepted,
        channels: values.channels,
        delivery: values.delivery,
        enabled: values.enabled,
        date: values.date,
        range: values.range,
      }),
    );
  }
  return (
    <>
      <schema.Form className="playground-builtin-form" showActions={false}>
        <ExampleFields form={schema.form} {...schema.presentation} />
      </schema.Form>
      <Button type="button" onClick={readPublicFields}>
        {text('preview')}
      </Button>
      <pre className="mt-4 min-w-0 max-w-full overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        <output aria-label={text('builtinPreview')}>{preview}</output>
      </pre>
    </>
  );
}

function LayoutPanel() {
  const text = useFormsText();
  const [result, setResult] = useState('—');
  const schema = useExampleForm<{ name: string; notes: string }>({
    fields: [
      { name: 'name', label: 'name', kind: 'text' },
      { name: 'notes', label: 'notes', kind: 'textarea', colSpan: 2 },
    ],
    layout: { columns: 2, labelWidth: 'auto' },
    onSubmit: async values => {
      setResult(`${values.name ?? ''} / ${values.notes ?? ''}`);
    },
  });
  return (
    <>
      <schema.Form submitLabel={text('submitLayout')}>
        <section aria-label={text('primary')}>
          <h3>{text('primary')}</h3>
          <ExampleFields form={schema.form} {...schema.presentation} names={['name']} />
        </section>
        <section aria-label={text('details')}>
          <h3>{text('details')}</h3>
          <ExampleFields form={schema.form} {...schema.presentation} names={['notes']} />
        </section>
      </schema.Form>
      <output aria-label={text('layoutResult')}>{result}</output>
    </>
  );
}

type CodeValues = { code: string };
type CodeFields = { 'custom:code': { prefix: string } };
const codeRenderers: CustomFieldRegistry<CodeValues, CodeFields> = {
  'custom:code': ({ field, shell, params, disabled }) => (
    <div>
      <CodePrefix label={params.prefix} />
      <Input
        {...shell}
        ref={field.ref}
        name={field.name}
        value={typeof field.value === 'string' ? field.value : ''}
        disabled={disabled}
        onBlur={field.onBlur}
        onChange={field.onChange}
      />
    </div>
  ),
};
function CodePrefix({ label }: { label: 'codePrefix' | string }) {
  const text = useFormsText();
  return <span aria-hidden="true">{label === 'codePrefix' ? text('codePrefix') : label}</span>;
}
function CustomPanel() {
  const text = useFormsText();
  const [result, setResult] = useState('—');
  const schema = useExampleForm<CodeValues, { code?: string }, CodeFields>({
    fields: [
      {
        name: 'code',
        label: 'code',
        kind: 'custom:code',
        componentProps: { prefix: 'codePrefix' },
        schema: z.string().regex(/^EX-\d+$/, 'app:examples.forms.codeError'),
      },
    ],
    defaultValues: { code: 'EX-1' },
    customFields: codeRenderers,
    onSubmit: async values => {
      setResult(values.code ?? '—');
    },
  });
  return (
    <>
      <p>{text('customHelp')}</p>
      <schema.Form submitLabel={text('submitCode')}>
        <ExampleFields form={schema.form} {...schema.presentation} />
      </schema.Form>
      <output aria-label={text('customResult')}>{result}</output>
    </>
  );
}

function DerivedPanel() {
  const text = useFormsText();
  const [result, setResult] = useState('—');
  const schema = useExampleForm<{ business: boolean; locked: boolean; company: string }>({
    fields: [
      { name: 'business', label: 'business', kind: 'checkbox' },
      { name: 'locked', label: 'locked', kind: 'checkbox' },
      {
        name: 'company',
        label: 'company',
        kind: 'text',
        dependencies: {
          fields: ['business', 'locked'],
          derive: values => ({
            visible: values.business,
            required: values.business,
            disabled: values.locked,
            schema: z.string().trim().min(1, 'app:examples.forms.companyError'),
          }),
        },
      },
    ],
    onSubmit: async values => {
      setResult(
        JSON.stringify({
          business: values.business,
          locked: values.locked,
          ...(values.company === undefined ? {} : { company: values.company }),
        }),
      );
    },
  });
  return (
    <>
      <p>{text('deriveHelp')}</p>
      <schema.Form submitLabel={text('submitDerived')}>
        <ExampleFields form={schema.form} {...schema.presentation} />
      </schema.Form>
      <output aria-label={text('derivedResult')}>{result}</output>
    </>
  );
}

const queryRows = [
  { id: '1', name: 'Ada', city: 'London' },
  { id: '2', name: 'Grace', city: 'New York' },
  { id: '3', name: 'Ada', city: 'Paris' },
];
function QueryPanel() {
  const text = useFormsText();
  const { t } = useTranslation();
  const fields: FormFieldConfig<{ keyword: string; city: string }>[] = [
    { name: 'keyword', label: 'keyword', kind: 'text' },
    { name: 'city', label: 'city', kind: 'text' },
  ];
  const controller = useQueryDataTable<
    { keyword: string; city: string },
    { keyword: string; city: string },
    (typeof queryRows)[number]
  >({
    scopeKey: 'synthetic:forms-query:local:generation-1',
    enabled: true,
    queryForm: {
      fields,
      layout: { columns: 1, labelWidth: 'auto', collapsedRows: 1 },
      transform: values => ({ keyword: values.keyword?.trim() ?? '', city: values.city?.trim() ?? '' }),
    },
    load: async ({ query, signal }) => {
      signal.throwIfAborted();
      const rows = queryRows.filter(
        row =>
          row.name.toLowerCase().includes(query.keyword.toLowerCase()) &&
          row.city.toLowerCase().includes(query.city.toLowerCase()),
      );
      return { rows, rowCount: rows.length };
    },
  });
  const Form = controller.queryForm.Form;
  return (
    <>
      <p>{text('queryHelp')}</p>
      <Form submitLabel={text('applyQuery')} resetLabel={text('resetQuery')}>
        <ExampleFields
          form={controller.queryForm.form}
          fields={fields}
          layout={{ columns: 1, labelWidth: 'auto', collapsedRows: 1 }}
        />
      </Form>
      {controller.tableState.error !== null && <p role="alert">{text('queryFailed')}</p>}
      {controller.tableState.readState === 'pending' && <p role="status">{t('common:read.loading.title')}</p>}
      {controller.tableState.readState === 'ready' && controller.tableState.model.rows.length === 0 && (
        <p role="status">{t('common:read.empty.title')}</p>
      )}
      <ul aria-label={text('queryResults')} aria-busy={controller.tableState.readState === 'pending'}>
        {controller.tableState.model.rows.map(row => (
          <li key={row.id}>
            {row.name} / {row.city}
          </li>
        ))}
      </ul>
    </>
  );
}

function nameField(): FormFieldConfig<NameValues> {
  return {
    name: 'name',
    label: 'name',
    kind: 'text',
    required: true,
    schema: z.string().trim().min(2, 'app:examples.forms.nameError'),
  };
}
function RulesPanel() {
  const text = useFormsText();
  const [name, setName] = useState('—');
  const schema = useExampleForm<NameValues>({
    fields: [nameField()],
    onSubmit: async values => {
      setName(values.name ?? '—');
    },
  });
  return (
    <>
      <p>{text('rulesHelp')}</p>
      <schema.Form submitLabel={text('submitValidated')}>
        <ExampleFields form={schema.form} {...schema.presentation} />
      </schema.Form>
      <output aria-label={text('validatedName')}>{name}</output>
    </>
  );
}
function FocusPanel() {
  const text = useFormsText();
  const [result, setResult] = useState('—');
  const schema = useExampleForm<{ hidden: string; info: string; name: string }>({
    fields: [
      {
        name: 'hidden',
        label: 'hiddenInvalid',
        kind: 'text',
        schema: z.string().min(1),
        dependencies: { fields: ['info'], derive: () => ({ visible: false }) },
      },
      { name: 'info', label: 'info', kind: 'text', disabled: true, defaultValue: 'synthetic-valid' },
      nameField(),
    ],
    layout: { columns: 1, labelWidth: 'auto', collapsedRows: 1 },
    onSubmit: async values => {
      setResult(values.name ?? '—');
    },
  });
  return (
    <>
      <p>{text('focusHelp')}</p>
      <schema.Form submitLabel={text('submitFocus')}>
        <ExampleFields form={schema.form} {...schema.presentation} />
      </schema.Form>
      <output aria-label={text('focusResult')}>{result}</output>
    </>
  );
}

function FormatPanel() {
  const text = useFormsText();
  const [raw, setRaw] = useState('—');
  const [dto, setDto] = useState('—');
  const schema = useExampleForm<
    { name: string; range: { start: string; end: string } },
    { displayName: string; startDate: string; endDate: string }
  >({
    fields: [
      { name: 'name', label: 'name', kind: 'text' },
      { name: 'range', label: 'range', kind: 'date-range' },
    ],
    transform: values => ({
      displayName: values.name?.trim() ?? '',
      startDate: values.range?.start ?? '',
      endDate: values.range?.end ?? '',
    }),
  });
  function compare() {
    const values = schema.getValues();
    const output = schema.toOutput(values);
    setRaw(JSON.stringify({ name: values.name, range: { start: values.range.start, end: values.range.end } }));
    setDto(JSON.stringify({ displayName: output.displayName, startDate: output.startDate, endDate: output.endDate }));
  }
  return (
    <>
      <p>{text('formatHelp')}</p>
      <schema.Form showActions={false}>
        <ExampleFields form={schema.form} {...schema.presentation} />
      </schema.Form>
      <div className="flex flex-wrap items-center justify-start gap-2">
        <Button type="button" onClick={compare}>
          {text('compare')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            schema.setValues({ name: '  Grace  ' }, { shouldDirty: true });
            // Set the composite through the public form owner so its parent binding is notified.
            schema.form.setValue('range', { start: '2026-11-01', end: '2026-11-30' }, { shouldDirty: true });
          }}
        >
          {text('setRaw')}
        </Button>
      </div>
      <pre className="mt-4 min-w-0 max-w-full overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        <output aria-label={text('rawFields')}>{raw}</output>
      </pre>
      <pre className="mt-4 min-w-0 max-w-full overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        <output aria-label={text('dtoFields')}>{dto}</output>
      </pre>
    </>
  );
}
