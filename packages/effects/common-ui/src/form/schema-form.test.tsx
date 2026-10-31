import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DeepPartial } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { render } from '../tests/fixtures';
import { useSchemaForm } from './useSchemaForm';
import type { SchemaFormApi, SchemaFormOptions } from './schema-types';
import type { FormFieldConfig, CustomFieldRegistry } from './types';

type Values = {
  mode: string;
  user: { name: string; password: string; secret: string };
  rows: { label: string; password: string }[];
  note: string;
  count: number | null;
  range: { start: string; end: string };
};
const defaults: Values = {
  mode: 'hide',
  user: { name: 'Ada', password: 'private', secret: 'token' },
  rows: [
    { label: 'first', password: 'row-secret' },
    { label: 'second', password: 'secret2' },
  ],
  note: '',
  count: null,
  range: { start: '2026-10-01', end: '2026-10-17' },
};
const fields: readonly FormFieldConfig<Values>[] = [
  { name: 'mode', label: 'Mode', kind: 'text' },
  { name: 'user.name', label: 'Name', kind: 'text', required: true, schema: z.string().min(2, 'Name too short') },
  {
    name: 'user.password',
    label: 'Password',
    kind: 'password',
    required: true,
    dependencies: { fields: ['mode'], derive: v => ({ visible: v.mode === 'show' }) },
  },
  { name: 'user.secret', label: 'Secret', kind: 'text', sensitive: true },
  { name: 'rows.0.label', label: 'First row', kind: 'text' },
  { name: 'rows.0.password', label: 'Row password', kind: 'password' },
  { name: 'rows.1.label', label: 'Second row', kind: 'text' },
  { name: 'rows.1.password', label: 'Row2 password', kind: 'password' },
  { name: 'note', label: 'Note', kind: 'textarea' },
  { name: 'count', label: 'Count', kind: 'number' },
  { name: 'range', label: 'Range', kind: 'date-range' },
];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

// Compile-time contract: the nested public projection cannot promise a complete user.
function projectionTypes(api: SchemaFormApi<Values>) {
  const output: DeepPartial<Values> = api.toOutput(api.getValues());
  const partial: typeof output = { user: { name: 'Ada' } };
  // @ts-expect-error sensitive and hidden nested leaves are optional
  const complete: Values['user'] = output.user!;
  // @ts-expect-error a different output requires an explicit transform
  const bad: SchemaFormOptions<Values, { startDate: string }> = { fields };
  const typed: SchemaFormOptions<
    { value: string },
    DeepPartial<{ value: string }>,
    { 'custom:prefix': { prefix: string } }
  > = {
    fields: [
      // @ts-expect-error frozen custom params map rejects the wrong prop type
      { name: 'value', label: 'Value', kind: 'custom:prefix', componentProps: { prefix: 1 } },
    ],
  };
  void [partial, complete, bad, typed];
}
void projectionTypes;

describe('SchemaForm values, projections and validation', () => {
  it('keeps raw nested values, projects individual leaves without array compaction or secret leakage, and copies output', () => {
    const { result } = renderHook(() => useSchemaForm<Values>({ fields, defaultValues: defaults }));
    const api = result.current;
    expect(api.getValues()).toEqual(defaults);
    const output = api.toOutput(api.getValues());
    expect(output.user).toEqual({ name: 'Ada', secret: 'token' });
    expect(api.filterDraft(api.getValues()).user).toEqual({ name: 'Ada' });
    expect(api.publicValues(api.getValues()).rows).toEqual([{ label: 'first' }, { label: 'second' }]);
    output.user!.name = 'mutated';
    expect(api.getValues().user.name).toBe('Ada');
    expect(api.filterDraft(api.getValues()).user).not.toHaveProperty('password');
  });
  it('retains hidden non-sensitive draft values and removes unknown or wrong-kind restored values', () => {
    const { result } = renderHook(() =>
      useSchemaForm<Values>({
        fields: fields.map(f =>
          f.name === 'note' ? { ...f, dependencies: { fields: ['mode'], derive: () => ({ visible: false }) } } : f,
        ),
        defaultValues: defaults,
      }),
    );
    expect(result.current.filterDraft({ ...defaults, note: 'restore me' }).note).toBe('restore me');
    act(() =>
      result.current.setValues(
        { user: { name: 'Restored', password: 'bad' }, count: 'wrong', extra: 'bad' } as unknown as DeepPartial<Values>,
        { shouldDirty: true },
      ),
    );
    expect(result.current.getValues().user).toEqual({ name: 'Restored', password: 'private', secret: 'token' });
    expect(result.current.getValues()).not.toHaveProperty('extra');
    expect(result.current.getValues().count).toBeNull();
  });
  it('validates visible disabled values and field schemas, filters hidden root errors while preserving root errors', async () => {
    const schema = z
      .object({
        mode: z.string(),
        user: z.object({ name: z.string(), password: z.string().min(50, 'hidden password'), secret: z.string() }),
        rows: z.array(z.object({ label: z.string(), password: z.string() })),
        note: z.string(),
        count: z.number().nullable(),
        range: z.object({ start: z.string(), end: z.string() }),
      })
      .superRefine((v, ctx) => {
        if (v.note === 'root') ctx.addIssue({ code: 'custom', message: 'root problem' });
      });
    const { result } = renderHook(() => useSchemaForm<Values>({ fields, schema, defaultValues: defaults }));
    let outcome;
    await act(async () => {
      outcome = await result.current.validate();
    });
    expect(outcome).toEqual({ valid: true, values: defaults });
    act(() => {
      result.current.updateFields([{ name: 'user.name', disabled: true }]);
      result.current.setValues({ user: { name: 'x' }, note: 'root' });
    });
    await act(async () => {
      outcome = await result.current.validate();
    });
    expect(outcome).toMatchObject({
      valid: false,
      errors: { user: { name: { message: 'Name too short' } }, root: { message: 'root problem' } },
    });
  });
  it('uses kind defaults, explicit defaults and field defaults in order, and reset keeps updateFields from changing baseline', async () => {
    const { result } = renderHook(() =>
      useSchemaForm<{ a: string; b: string; c: number | null; d: boolean; e: string[] }>({
        fields: [
          { name: 'a', label: 'A', kind: 'text', defaultValue: 'field' },
          { name: 'b', label: 'B', kind: 'text', defaultValue: 'field' },
          { name: 'c', label: 'C', kind: 'number' },
          { name: 'd', label: 'D', kind: 'checkbox' },
          { name: 'e', label: 'E', kind: 'checkbox-group' },
        ],
        defaultValues: { a: 'explicit' },
      }),
    );
    expect(result.current.getValues()).toEqual({ a: 'explicit', b: 'field', c: null, d: false, e: [] });
    act(() => {
      result.current.setValues({ a: 'changed' }, { shouldDirty: true });
      result.current.updateFields([{ name: 'a', label: 'Renamed', defaultValue: 'new field' }]);
    });
    expect(result.current.getValues().a).toBe('changed');
    act(() => result.current.reset());
    expect(result.current.getValues().a).toBe('explicit');
    expect(result.current.configVersion).toBe(1);
  });
  it('runs a pure explicit range DTO transform after visibility and leaves RHF untouched', () => {
    const { result } = renderHook(() =>
      useSchemaForm<Values, { name?: string; startDate?: string; endDate?: string }>({
        fields,
        defaultValues: defaults,
        transform: v => ({ name: v.user?.name, startDate: v.range?.start, endDate: v.range?.end }),
      }),
    );
    expect(result.current.toOutput(result.current.getValues())).toEqual({
      name: 'Ada',
      startDate: '2026-10-01',
      endDate: '2026-10-17',
    });
    expect(result.current.getValues().range).toEqual(defaults.range);
  });
  it.each(['duplicate', 'unknown dependency', 'cycle', 'prototype', 'unknown custom', 'override builtin'])(
    'rejects %s configuration',
    problem => {
      const bad = [...fields];
      if (problem === 'duplicate') bad.push(fields[0]);
      if (problem === 'unknown dependency')
        bad[0] = { ...bad[0], dependencies: { fields: ['missing' as 'note'], derive: () => ({}) } };
      if (problem === 'cycle') {
        bad[0] = { ...bad[0], dependencies: { fields: ['note'], derive: () => ({}) } };
        bad[8] = { ...bad[8], dependencies: { fields: ['mode'], derive: () => ({}) } };
      }
      if (problem === 'prototype') bad[0] = { ...bad[0], name: '__proto__.polluted' as 'note' };
      if (problem === 'unknown custom') bad[0] = { ...bad[0], kind: 'custom:missing' };
      expect(() =>
        renderHook(() =>
          useSchemaForm<Values>({
            fields: bad,
            customFields: problem === 'override builtin' ? ({ text: () => null } as never) : undefined,
          }),
        ),
      ).toThrow();
    },
  );
  it('rejects async Zod and type-changing transforms as configuration errors', async () => {
    for (const schema of [z.string().refine(async () => true), z.string().transform(v => v.length)]) {
      const { result, unmount } = renderHook(() =>
        useSchemaForm<{ a: string }>({
          fields: [{ name: 'a', label: 'A', kind: 'text', schema }],
          defaultValues: { a: 'value' },
        }),
      );
      await expect(result.current.validate()).rejects.toThrow(/sync|type|transform/i);
      unmount();
    }
  });
});

describe('SchemaForm rendered owner and operation lifecycle', () => {
  it('preserves DOM, focus, continuously dirty values and component identities across inline options, layout and patches', async () => {
    let api!: SchemaFormApi<Values>;
    function Editor({ columns }: { columns: number }) {
      api = useSchemaForm<Values>({
        fields: fields.map(f => ({ ...f, group: 'main' })),
        defaultValues: defaults,
        schema: z.any(),
        layout: { columns, labelWidth: 120 },
        groups: [{ id: 'main', title: `Columns ${columns}` }],
      });
      return <api.Form />;
    }
    const view = render(<Editor columns={1} />);
    const firstForm = api.Form;
    const firstFields = api.Fields;
    const input = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.click(input);
    await userEvent.type(input, 'xyz');
    view.rerender(<Editor columns={2} />);
    expect(api.Form).toBe(firstForm);
    expect(api.Fields).toBe(firstFields);
    expect(screen.getByRole('group', { name: 'Columns 2' })).toContainElement(input);
    expect(
      (input.closest('[data-schema-field]')?.parentElement as HTMLElement).style.getPropertyValue('--schema-columns'),
    ).toBe('2');
    expect(input).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(input);
    expect(api.form.formState.isDirty).toBe(true);
    act(() => api.updateFields([{ name: 'user.name', label: 'Renamed' }]));
    expect(screen.getByRole('textbox', { name: 'Renamed' })).toBe(input);
    expect(input).toHaveFocus();
    expect(api.getValues().user.name).toBe('Adaxyz');
  });
  it('supports app-owned groups with names and no additional form, dynamic rule/props, collapsed errors expand before focus', async () => {
    let api!: SchemaFormApi<{ mode: string; detail: string }>;
    function Editor() {
      api = useSchemaForm({
        fields: [
          { name: 'mode', label: 'Mode', kind: 'text' },
          {
            name: 'detail',
            label: 'Detail',
            kind: 'text',
            dependencies: {
              fields: ['mode'],
              derive: v => ({
                visible: v.mode !== 'hide',
                required: true,
                schema: z.string().min(3, 'Three chars'),
                componentProps: { placeholder: 'derived' },
              }),
            },
          },
        ],
        defaultValues: { mode: 'show', detail: '' },
        layout: { columns: 1, labelWidth: 80, collapsedRows: 1 },
      });
      return (
        <api.Form submitLabel="查询">
          <api.Fields names={['mode', 'detail']} />
        </api.Form>
      );
    }
    render(<Editor />);
    expect(document.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByPlaceholderText('derived')).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(screen.getByPlaceholderText('derived')).toHaveFocus());
    act(() => api.setValues({ mode: 'hide' }));
    await waitFor(() => expect(screen.queryByLabelText('Detail')).not.toBeInTheDocument());
    await act(async () => {
      expect((await api.validate()).valid).toBe(true);
    });
  });
  it('does not submit Enter from textarea or IME, and does submit from a normal field', async () => {
    const save = vi.fn(async () => {});
    function Editor() {
      const api = useSchemaForm<Values>({ fields, defaultValues: defaults, onSubmit: save });
      return <api.Form />;
    }
    render(<Editor />);
    const user = userEvent.setup();
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter', isComposing: true });
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText('Note'));
    await user.keyboard('{Enter}');
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText('Name'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });
  it('renders a typed custom registry through the existing separate component contract', async () => {
    type V = { value: string };
    type C = { 'custom:prefix': { prefix: string } };
    const customFields: CustomFieldRegistry<V, C> = {
      'custom:prefix': ({ field, shell, params }) => <input {...field} {...shell} aria-label={params.prefix} />,
    };
    function Editor() {
      const api = useSchemaForm<V, DeepPartial<V>, C>({
        fields: [{ name: 'value', label: 'Value', kind: 'custom:prefix', componentProps: { prefix: 'Typed prefix' } }],
        customFields,
      });
      return <api.Form />;
    }
    render(<Editor />);
    await userEvent.type(screen.getByLabelText('Typed prefix'), 'ok');
    expect(screen.getByLabelText('Typed prefix')).toHaveValue('ok');
  });
  it.each(['edit', 'config', 'cancel', 'reset', 'external abort', 'unmount'])(
    'cancels an old save on %s without claiming success',
    async cause => {
      const pending = deferred();
      let signal!: AbortSignal;
      const { result, unmount } = renderHook(() =>
        useSchemaForm<Values>({
          fields,
          defaultValues: defaults,
          onSubmit: async (_, context) => {
            signal = context.signal;
            await pending.promise;
          },
        }),
      );
      const controller = new AbortController();
      let submitted!: Promise<unknown>;
      act(() => {
        submitted = result.current.submit({ signal: controller.signal });
      });
      await waitFor(() => expect(signal).toBeDefined());
      if (cause === 'edit') act(() => result.current.setValues({ note: 'new' }));
      if (cause === 'config') act(() => result.current.updateFields([{ name: 'note', label: 'new' }]));
      if (cause === 'cancel') act(() => result.current.cancel());
      if (cause === 'reset') act(() => result.current.reset());
      if (cause === 'external abort') act(() => controller.abort());
      if (cause === 'unmount') unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => {
        pending.resolve();
        expect(await submitted).toBe('cancelled');
      });
    },
  );
  it('separates validated, invalid, submitted and errors and aborts repeated submissions', async () => {
    const pending = deferred();
    const signals: AbortSignal[] = [];
    const { result } = renderHook(() =>
      useSchemaForm<Values>({
        fields,
        defaultValues: defaults,
        onSubmit: async (_, ctx) => {
          signals.push(ctx.signal);
          if (signals.length === 1) await pending.promise;
        },
      }),
    );
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.submit();
    });
    await waitFor(() => expect(signals).toHaveLength(1));
    await act(async () => expect(await result.current.submit()).toBe('submitted'));
    expect(signals[0].aborted).toBe(true);
    await act(async () => {
      pending.resolve();
      expect(await first).toBe('cancelled');
    });
    const plain = renderHook(() => useSchemaForm<Values>({ fields, defaultValues: defaults }));
    await act(async () => expect(await plain.result.current.submit()).toBe('validated'));
    act(() => plain.result.current.setValues({ user: { name: '' } }));
    await act(async () => expect(await plain.result.current.submit()).toBe('invalid'));
  });
});

describe('projection and owner edge regressions', () => {
  it('keeps later array indices when the first item contains only hidden/sensitive fields', () => {
    const configured = fields.map(field =>
      field.name === 'rows.0.label'
        ? { ...field, dependencies: { fields: ['mode' as const], derive: () => ({ visible: false }) } }
        : field,
    );
    const { result } = renderHook(() => useSchemaForm<Values>({ fields: configured, defaultValues: defaults }));
    const projection = result.current.publicValues(result.current.getValues());
    expect(projection.rows).toHaveLength(2);
    expect(projection.rows?.[0]).toBeUndefined();
    expect(projection.rows?.[1]).toEqual({ label: 'second' });
    expect(result.current.getValues().rows[0]).toEqual(defaults.rows[0]);
  });
  it('replaces field rules dynamically, retains visible disabled values, and enforces hidden-required only after reveal', async () => {
    const { result } = renderHook(() =>
      useSchemaForm<{ mode: string; value: string }>({
        fields: [
          { name: 'mode', label: 'Mode', kind: 'text' },
          {
            name: 'value',
            label: 'Value',
            kind: 'text',
            schema: z.string().min(100),
            dependencies: {
              fields: ['mode'],
              derive: v => ({
                visible: v.mode !== 'hidden',
                required: true,
                disabled: true,
                schema: z.string().min(2, 'dynamic rule'),
              }),
            },
          },
        ],
        defaultValues: { mode: 'hidden', value: '' },
      }),
    );
    await act(async () => expect((await result.current.validate()).valid).toBe(true));
    act(() => result.current.setValues({ mode: 'show' }));
    await act(async () => expect(await result.current.validate()).toMatchObject({ valid: false }));
    act(() => result.current.setValues({ value: 'ok' }));
    await act(async () => expect((await result.current.validate()).valid).toBe(true));
    expect(result.current.toOutput(result.current.getValues())).toEqual({ mode: 'show', value: 'ok' });
  });
  it('keeps a pending operation through ordinary inline rerenders, but raw form edits abort it', async () => {
    const pending = deferred();
    let signal!: AbortSignal;
    const save = async (_: DeepPartial<Values>, context: { signal: AbortSignal }) => {
      signal = context.signal;
      await pending.promise;
    };
    const { result, rerender } = renderHook(
      ({ label }) =>
        useSchemaForm<Values>({
          fields: fields.map(f => ({ ...f, label })),
          defaultValues: { ...defaults },
          schema: z.any(),
          onSubmit: save,
        }),
      { initialProps: { label: 'first' } },
    );
    let operation!: Promise<unknown>;
    act(() => {
      operation = result.current.submit();
    });
    await waitFor(() => expect(signal).toBeDefined());
    rerender({ label: 'rerender' });
    expect(signal.aborted).toBe(false);
    act(() => result.current.form.setValue('note', 'raw edit', { shouldDirty: true }));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      pending.resolve();
      expect(await operation).toBe('cancelled');
    });
  });
  it('reports submit failures as error without clearing values, and rejects unsafe/unknown patches', async () => {
    const { result } = renderHook(() =>
      useSchemaForm<Values>({
        fields,
        defaultValues: defaults,
        onSubmit: async () => {
          throw new Error('private');
        },
      }),
    );
    await act(async () => expect(await result.current.submit()).toBe('error'));
    expect(result.current.getValues()).toEqual(defaults);
    expect(() => result.current.updateFields([{ name: 'notDeclared' as 'note', label: 'bad' }])).toThrow(/unknown/i);
    act(() => result.current.setValues(JSON.parse('{"__proto__":{"polluted":"yes"},"user":{"name":"safe"}}')));
    expect(result.current.getValues().user.name).toBe('safe');
    expect({}).not.toHaveProperty('polluted');
  });
});

describe('current baseline and validation snapshots', () => {
  it('reset uses the current RHF default baseline established by a successful owner reset', () => {
    const { result } = renderHook(() => useSchemaForm<Values>({ fields, defaultValues: defaults }));
    act(() => result.current.form.reset({ ...defaults, note: 'saved baseline' }));
    act(() => result.current.setValues({ note: 'unsaved edit' }, { shouldDirty: true }));
    act(() => result.current.reset());
    expect(result.current.getValues().note).toBe('saved baseline');
    expect(result.current.form.formState.isDirty).toBe(false);
  });
  it('validate returns the raw values snapshot it checked when a later edit happens before the await resumes', async () => {
    const { result } = renderHook(() => useSchemaForm<Values>({ fields, defaultValues: defaults }));
    await act(async () => {
      const validation = result.current.validate();
      result.current.form.setValue('user.name', '');
      expect(await validation).toMatchObject({ valid: true, values: { user: { name: 'Ada' } } });
    });
    expect(result.current.getValues().user.name).toBe('');
  });
});

describe('original root schema authority', () => {
  it('preserves original root-required and superRefine messages ahead of synthetic required and leaves numeric/date strings unchanged', async () => {
    type Legacy = { title: string; quantity: string; validDate: string };
    const schema = z
      .object({ title: z.string().min(1, '原名称必填'), quantity: z.string(), validDate: z.string() })
      .superRefine((values, ctx) => {
        if (values.quantity !== '' && (!/^\d+(\.\d+)?$/.test(values.quantity) || Number(values.quantity) < 0))
          ctx.addIssue({ code: 'custom', path: ['quantity'], message: '原非负数量规则' });
        if (values.validDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.validDate))
          ctx.addIssue({ code: 'custom', path: ['validDate'], message: '原日期规则' });
      });
    const { result } = renderHook(() =>
      useSchemaForm<Legacy>({
        fields: [
          { name: 'title', label: '名称', kind: 'text', required: true },
          { name: 'quantity', label: '数量', kind: 'text' },
          { name: 'validDate', label: '日期', kind: 'text' },
        ],
        defaultValues: { title: '', quantity: '-1', validDate: 'bad' },
        schema,
      }),
    );
    await act(async () =>
      expect(await result.current.validate()).toMatchObject({
        valid: false,
        errors: {
          title: { message: '原名称必填' },
          quantity: { message: '原非负数量规则' },
          validDate: { message: '原日期规则' },
        },
      }),
    );
    act(() => result.current.setValues({ title: '原设备', quantity: '0001.50', validDate: '2026-10-17' }));
    await act(async () => expect((await result.current.validate()).valid).toBe(true));
    expect(result.current.toOutput(result.current.getValues())).toEqual({
      title: '原设备',
      quantity: '0001.50',
      validDate: '2026-10-17',
    });
  });
});

describe('configuration and composite restore edges', () => {
  it('collapses whole visual rows when a wide field starts on the next grid row', () => {
    function Editor() {
      const api = useSchemaForm<{ first: string; wide: string }>({
        fields: [
          { name: 'first', label: 'Narrow first', kind: 'text' },
          { name: 'wide', label: 'Wide next row', kind: 'text', colSpan: 2 },
        ],
        layout: { columns: 2, labelWidth: 80, collapsedRows: 1 },
      });
      return <api.Form />;
    }
    render(<Editor />);
    expect(screen.getByLabelText('Narrow first')).toBeVisible();
    expect(screen.getByLabelText('Wide next row')).not.toBeVisible();
  });
  it('rejects a dependency on an undeclared descendant of a scalar field and duplicate dependencies', () => {
    for (const deps of [['mode.unknown'], ['mode', 'mode']]) {
      expect(() =>
        renderHook(() =>
          useSchemaForm<{ mode: string; detail: string }>({
            fields: [
              { name: 'mode', label: 'Mode', kind: 'text' },
              {
                name: 'detail',
                label: 'Detail',
                kind: 'text',
                dependencies: { fields: deps as ['mode'], derive: () => ({}) },
              },
            ],
          }),
        ),
      ).toThrow(/dependency/i);
    }
  });
  it('restores custom object values from the explicit typed baseline while preserving sensitive raw siblings', () => {
    type V = { meta: { name: string; password: string } };
    const { result } = renderHook(() =>
      useSchemaForm<V>({
        fields: [
          { name: 'meta', label: 'Composite', kind: 'custom:object' },
          { name: 'meta.password', label: 'Password', kind: 'password' },
        ],
        defaultValues: { meta: { name: 'initial', password: 'keep raw' } },
        customFields: { 'custom:object': () => null },
      }),
    );
    expect(result.current.filterDraft(result.current.getValues())).toEqual({ meta: { name: 'initial' } });
    act(() => result.current.setValues({ meta: { name: 'restored', password: 'never inject' } }));
    expect(result.current.getValues()).toEqual({ meta: { name: 'restored', password: 'keep raw' } });
    expect(result.current.publicValues(result.current.getValues())).toEqual({ meta: { name: 'restored' } });
  });
});

describe('responsive layout ownership', () => {
  it('exposes columns/spans as CSS variables without inline grid declarations that override the existing mobile layout', () => {
    function Editor() {
      const api = useSchemaForm<{ value: string }>({
        fields: [{ name: 'value', label: 'Responsive field', kind: 'text', colSpan: 2 }],
        layout: { columns: 2, labelWidth: 120 },
      });
      return <api.Form />;
    }
    render(<Editor />);
    const cell = screen.getByLabelText('Responsive field').closest<HTMLElement>('[data-schema-field]')!;
    const grid = cell.parentElement!;
    expect(grid).toHaveClass('pattern-schema-grid');
    expect(grid.style.getPropertyValue('--schema-columns')).toBe('2');
    expect(grid.style.getPropertyValue('--label-w')).toBe('120px');
    expect(grid.style.gridTemplateColumns).toBe('');
    expect(cell).toHaveClass('pattern-schema-cell');
    expect(cell.style.getPropertyValue('--schema-col-span')).toBe('2');
    expect(cell.style.gridColumn).toBe('');
  });
});
