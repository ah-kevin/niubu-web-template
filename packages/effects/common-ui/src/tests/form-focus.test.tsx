import { useState } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { render } from './fixtures';
import userEvent from '@testing-library/user-event';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useRestorableForm } from '@niubu/common-ui/form-frame';
import { FormFrame, type FormGroupDefinition } from '@niubu/common-ui/form-frame';
import { InteractionProvider } from '@niubu/stores/react';

const focusSchema = z.object({ first: z.string().min(1), later: z.string().min(1) });
type Values = z.infer<typeof focusSchema>;
const visualGroups: readonly FormGroupDefinition<Values>[] = [
  { label: '视觉首组', fields: ['first'] },
  { label: '视觉后组', fields: ['later'] },
];

function OrderedContents({
  form,
  groups,
}: {
  form: UseFormReturn<Values>;
  groups?: readonly FormGroupDefinition<Values>[];
}) {
  // Register the visual second field first, before either ref is mounted.
  const later = form.register('later', { required: '请填写后项' });
  const first = form.register('first', { required: '请填写首项' });
  return <>
    <FormFrame
      form={form}
      title="专业显示顺序"
      scopeKey="workspace:a"
      draftKey="focus-order"
      onCancel={() => {}}
      groups={groups}
    >
      <input aria-label="视觉首项" {...first} aria-invalid={form.getFieldState('first', form.formState).invalid} />
      <input aria-label="视觉后项" {...later} aria-invalid={form.getFieldState('later', form.formState).invalid} />
    </FormFrame>
    <output aria-label="RHF 提交次数">{form.formState.submitCount}</output>
    <output aria-label="RHF 已提交">{String(form.formState.isSubmitted)}</output>
  </>;
}

function RestorableEditor({ groups }: { groups?: readonly FormGroupDefinition<Values>[] }) {
  const form = useRestorableForm({ schema: focusSchema, defaultValues: { first: '', later: '' }, scopeKey: 'workspace:a', draftKey: 'focus-order' });
  return <OrderedContents form={form} groups={groups} />;
}

function ExternalEditor({ groups }: { groups?: readonly FormGroupDefinition<Values>[] }) {
  // The public UseFormReturn contract also accepts RHF's default focus setting.
  const form = useForm<Values>({ defaultValues: { first: '', later: '' } });
  return <OrderedContents form={form} groups={groups} />;
}

async function settleValidation() {
  await screen.findByRole('alert');
  // Wait beyond the built-in RHF handleSubmit focus timeout that caused M1.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
}

describe('FormFrame owns preview error focus in current DOM order', () => {
  for (const [name, groups] of [
    ['matching groups', visualGroups],
    ['reversed groups', [...visualGroups].reverse()],
    ['no groups', undefined],
  ] as const) {
    it(`focuses the first displayed invalid field with reversed registration and ${name}`, async () => {
      render(<InteractionProvider><RestorableEditor groups={groups} /></InteractionProvider>);
      await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
      await settleValidation();
      expect(screen.getByLabelText('视觉首项')).toHaveFocus();
      if (groups) expect(screen.getByRole('alert')).toHaveTextContent(groups[0].label);
    });
  }

  for (const groups of [visualGroups, [...visualGroups].reverse(), undefined]) {
    it(`works for external UseFormReturn with default auto-focus and ${groups ? groups[0].label : 'no groups'}`, async () => {
      render(<InteractionProvider><ExternalEditor groups={groups} /></InteractionProvider>);
      await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
      await settleValidation();
      expect(screen.getByLabelText('视觉首项')).toHaveFocus();
    });
  }

  it('focuses the next displayed invalid field after the first is corrected', async () => {
    const user = userEvent.setup();
    render(<InteractionProvider><RestorableEditor groups={visualGroups} /></InteractionProvider>);
    await user.click(screen.getByRole('button', { name: '检查并继续' }));
    await settleValidation();
    expect(screen.getByLabelText('视觉首项')).toHaveFocus();
    await user.type(screen.getByLabelText('视觉首项'), '已修正');
    await user.click(screen.getByRole('button', { name: '检查并继续' }));
    await settleValidation();
    expect(screen.getByLabelText('视觉后项')).toHaveFocus();
  });

  it('shows actual preview validation feedback without pretending an RHF submission happened', async () => {
    render(<InteractionProvider><ExternalEditor /></InteractionProvider>);
    await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
    await settleValidation();
    expect(screen.getByRole('alert')).toHaveTextContent('请修正以下信息');
    expect(screen.getByLabelText('RHF 提交次数')).toHaveTextContent('0');
    expect(screen.getByLabelText('RHF 已提交')).toHaveTextContent('false');
  });

  it('validates full Zod cross-field rules before opening review', async () => {
    const crossFieldSchema = focusSchema.refine((values) => values.first !== values.later, { path: ['first'], message: '两项不能相同' });
    function Editor() {
      const form = useRestorableForm({ schema: crossFieldSchema, defaultValues: { first: '相同', later: '相同' }, scopeKey: 'workspace:a', draftKey: 'cross-field' });
      return <OrderedContents form={form} />;
    }
    render(<InteractionProvider><Editor /></InteractionProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '检查并继续' }));
    await settleValidation();
    expect(screen.getByLabelText('视觉首项')).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('视觉首项'));
    await user.type(screen.getByLabelText('视觉首项'), '不同');
    await user.click(screen.getByRole('button', { name: '检查并继续' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('核对登记预览');
    await user.click(screen.getByRole('button', { name: '返回修改' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '检查并继续' })).toHaveFocus());
  });

  it('does not replay error focus after Cancel, stay, or Escape restores the cancel trigger', async () => {
    const user = userEvent.setup();
    render(<InteractionProvider><RestorableEditor groups={visualGroups} /></InteractionProvider>);
    await user.type(screen.getByLabelText('视觉后项'), '脏输入');
    await user.click(screen.getByRole('button', { name: '检查并继续' }));
    await settleValidation();
    const cancel = screen.getByRole('button', { name: '取消' });
    await user.click(cancel);
    await user.click(screen.getByRole('button', { name: '继续编辑' }));
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.click(cancel);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(cancel).toHaveFocus());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    expect(cancel).toHaveFocus();
    expect(screen.getByLabelText('视觉后项')).toHaveValue('脏输入');
  });

  for (const valid of [false, true]) {
    it(`Cancel interrupts pending async Zod validation (${valid ? 'valid' : 'invalid'}) without stealing guard focus or opening review`, async () => {
      let finishValidation!: (valid: boolean) => void;
      const result = new Promise<boolean>((resolve) => { finishValidation = resolve; });
      const asyncSchema = focusSchema.refine(() => result, { path: ['first'], message: '异步检查未通过' });
      function Editor() {
        const form = useRestorableForm({ schema: asyncSchema, defaultValues: { first: '', later: '后项' }, scopeKey: 'workspace:a', draftKey: 'pending-validation' });
        return <OrderedContents form={form} groups={visualGroups} />;
      }
      const user = userEvent.setup();
      render(<InteractionProvider><Editor /></InteractionProvider>);
      await user.type(screen.getByLabelText('视觉首项'), '待检查输入');
      await user.click(screen.getByRole('button', { name: '检查并继续' }));
      const cancel = screen.getByRole('button', { name: '取消' });
      await user.click(cancel);
      expect(screen.getByRole('alertdialog')).toHaveTextContent('有未提交的输入');
      await act(async () => { finishValidation(valid); await result; });
      expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
      expect(screen.getByRole('alertdialog')).toContainElement(document.activeElement as HTMLElement);
      expect(screen.queryByText('核对登记预览')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '继续编辑' }));
      await waitFor(() => expect(cancel).toHaveFocus());
      expect(screen.getByLabelText('视觉首项')).toHaveValue('待检查输入');
    });
  }
});

describe('first error means an actual available DOM control', () => {
  for (const unavailable of ['hidden', 'display-none', 'disabled-fieldset', 'inert'] as const) {
    it(`skips a ${unavailable} invalid control before the first visible input`, async () => {
      function Editor() {
        const form = useRestorableForm({ schema: focusSchema, defaultValues: { first: '', later: '' }, scopeKey: 'workspace:a', draftKey: 'skip-unavailable' });
        return <FormFrame form={form} title="可操作首错" scopeKey="workspace:a" draftKey="skip-unavailable" onCancel={() => {}} groups={visualGroups}>
          <fieldset hidden={unavailable === 'hidden'} disabled={unavailable === 'disabled-fieldset'} inert={unavailable === 'inert'} style={unavailable === 'display-none' ? { display: 'none' } : undefined}>
            <input aria-label="不可用错误字段" {...form.register('first')} />
          </fieldset>
          <input aria-label="可用错误字段" {...form.register('later')} />
        </FormFrame>;
      }
      render(<InteractionProvider><Editor /></InteractionProvider>);
      await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
      await settleValidation();
      expect(screen.getByLabelText('可用错误字段')).toHaveFocus();
    });
  }

  it('uses the current DOM order after controls are reordered', async () => {
    function Editor() {
      const [reversed, setReversed] = useState(false);
      const form = useRestorableForm({ schema: focusSchema, defaultValues: { first: '', later: '' }, scopeKey: 'workspace:a', draftKey: 'reorder' });
      const fields = [<input key="first" aria-label="首项" {...form.register('first')} />, <input key="later" aria-label="后项" {...form.register('later')} />];
      return <FormFrame form={form} title="当前显示顺序" scopeKey="workspace:a" draftKey="reorder" onCancel={() => {}} groups={visualGroups}>
        <button type="button" onClick={() => setReversed(true)}>调整显示顺序</button>
        {reversed ? fields.reverse() : fields}
      </FormFrame>;
    }
    render(<InteractionProvider><Editor /></InteractionProvider>);
    await userEvent.click(screen.getByRole('button', { name: '调整显示顺序' }));
    await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
    await settleValidation();
    expect(screen.getByLabelText('后项')).toHaveFocus();
  });

  it('focuses a domain-owned visible control bound to a hidden registered field', async () => {
    function Editor() {
      const form = useRestorableForm({ schema: focusSchema, defaultValues: { first: '', later: '' }, scopeKey: 'workspace:a', draftKey: 'custom-focus' });
      return <FormFrame form={form} title="领域控件" scopeKey="workspace:a" draftKey="custom-focus" onCancel={() => {}}>
        <input type="hidden" {...form.register('first')} />
        <button type="button" data-field-name="first">请选择首项</button>
        <input aria-label="后续字段" {...form.register('later')} />
      </FormFrame>;
    }
    render(<InteractionProvider><Editor /></InteractionProvider>);
    await userEvent.click(screen.getByRole('button', { name: '检查并继续' }));
    await settleValidation();
    expect(screen.getByRole('button', { name: '请选择首项' })).toHaveFocus();
  });
});
