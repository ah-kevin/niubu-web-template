import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLayoutEffect, useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form';
import { InteractionProvider } from '@niubu/stores/react';
import { useInteractionState } from '@niubu/stores';
import { z } from 'zod';
import { useRestorableForm } from './restorable-form';
import { FormFrame, FormField, type FormFrameProps } from './FormFrame';
import { render } from '../tests/fixtures';

type V = { name: string; password: string };
let form!: UseFormReturn<V>;
let state!: ReturnType<typeof useInteractionState>;
function State() {
  const current = useInteractionState();
  useLayoutEffect(() => {
    state = current;
  });
  return <output aria-label="dirty">{String(current.dirty)}</output>;
}
function Fixture(props: Partial<FormFrameProps<V>>) {
  const current = useForm<V>({ defaultValues: { name: '', password: '' } });
  useLayoutEffect(() => {
    form = current;
  });
  return (
    <FormFrame form={current} title="Live editor" scopeKey="scope" draftKey="record" onCancel={() => {}} {...props}>
      <FormField name="name" label="Name" />
      <FormField name="password" label="Password" type="password" />
    </FormFrame>
  );
}
function View(props: Partial<FormFrameProps<V>>) {
  return (
    <InteractionProvider>
      <State />
      <Fixture {...props} />
    </InteractionProvider>
  );
}
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function review() {
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  return screen.findByRole('alertdialog');
}
async function confirm() {
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '确认保存' }));
}
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
});

describe('FormFrame explicit live submission', () => {
  it('works without preview provider; waits with review open, prevents duplicate save; cleans captured baseline/draft before notifying app', async () => {
    const pending = deferred();
    const save = vi.fn(() => pending.promise);
    const done = vi.fn(() => {
      expect(form.formState.isDirty).toBe(false);
      expect(state.readDraft('scope', 'record')).toBeUndefined();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    render(<View onSubmit={save} onSubmitted={done} formId="live-editor" />);
    await userEvent.type(screen.getByLabelText('Name'), 'saved record');
    await review();
    await confirm();
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: '保存中' })).toBeDisabled();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Name')).toHaveValue('saved record');
    expect(screen.getByLabelText('dirty')).toHaveTextContent('false');
    expect(document.getElementById('live-editor')?.tagName).toBe('FORM');
  });
  it('failure retains review, input and draft; unknown error details never appear; user can explicitly reconfirm', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('token=private')).mockResolvedValueOnce(undefined);
    render(<View onSubmit={save} />);
    await userEvent.type(screen.getByLabelText('Name'), 'keep');
    await review();
    await confirm();
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('保存失败');
    expect(screen.queryByText(/token=private/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('keep');
    expect(state.readDraft('scope', 'record')).toMatchObject({ name: 'keep' });
    await confirm();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(save).toHaveBeenCalledTimes(2);
  });
  it.each(['edit', 'operationKey', 'readiness', 'record', 'cancel', 'unmount'])(
    'actively aborts old live save on %s; late result cannot clear input/draft or call app',
    async cause => {
      const pending = deferred();
      let signal!: AbortSignal;
      let cancel!: (() => void) | null;
      const done = vi.fn();
      const props = {
        onSubmit: vi.fn(async (_: V, ctx: { signal: AbortSignal }) => {
          signal = ctx.signal;
          await pending.promise;
        }),
        onSubmitted: done,
        operationKey: 'generation1',
        onCancelReady: (command: (() => void) | null) => {
          cancel = command;
        },
      };
      const view = render(<View {...props} />);
      await userEvent.type(screen.getByLabelText('Name'), 'first');
      await review();
      await confirm();
      expect(signal.aborted).toBe(false);
      if (cause === 'edit') act(() => form.setValue('name', 'new input', { shouldDirty: true }));
      if (cause === 'operationKey') view.rerender(<View {...props} operationKey="generation2" />);
      if (cause === 'readiness') view.rerender(<View {...props} reviewReady={false} />);
      if (cause === 'record') view.rerender(<View {...props} draftKey="record2" />);
      if (cause === 'cancel') act(() => cancel?.());
      if (cause === 'unmount') view.unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => {
        pending.resolve();
        await pending.promise;
      });
      expect(done).not.toHaveBeenCalled();
      if (cause !== 'unmount') {
        expect(form.formState.isDirty).toBe(true);
        expect(screen.getByLabelText('Name')).toHaveValue(cause === 'edit' ? 'new input' : 'first');
      }
    },
  );
  it('all draft paths filter sensitive values and outside cancel uses one stable command', async () => {
    const error = vi.spyOn(console, 'error'); // Call-through: diagnostics stay visible if this boundary regresses.
    try {
      let cancel!: (() => void) | null;
      const commands: unknown[] = [];
      const onCancel = vi.fn();
      const filter = (v: V) => ({ name: v.name });
      const ready = (c: (() => void) | null) => {
        commands.push(c);
        cancel = c;
      };
      const view = render(
        <View onSubmit={async () => {}} draftFilter={filter} onCancel={onCancel} onCancelReady={ready} />,
      );
      await userEvent.type(screen.getByLabelText('Password'), 'private');
      const name = screen.getByLabelText('Name');
      // Keep a focused dirty input without user-event's deferred blur/change workaround nesting act during Radix autofocus.
      act(() => name.focus());
      fireEvent.change(name, { target: { value: 'draft' } });
      expect(state.readDraft('scope', 'record')).toEqual({ name: 'draft' });
      const command = cancel;
      view.rerender(
        <View
          onSubmit={async () => {}}
          draftFilter={filter}
          onCancel={onCancel}
          onCancelReady={ready}
          operationKey="new"
        />,
      );
      expect(cancel).toBe(command);
      expect(name).toHaveFocus();
      expect(name).toHaveValue('draft');
      await act(async () => {
        cancel?.();
      });
      await userEvent.click(screen.getByRole('button', { name: '保留草稿并离开' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(state.readDraft('scope', 'record')).toEqual({ name: 'draft' });
      view.unmount();
      expect(commands.at(-1)).toBeNull();
    } finally {
      const warnings = error.mock.calls.filter(
        ([message]) =>
          typeof message === 'string' &&
          (message.includes('inside a test was not wrapped in act(') ||
            message.includes('A component suspended inside an `act` scope, but the `act` call was not awaited.')),
      );
      error.mockRestore();
      expect(warnings).toEqual([]);
    }
  });
});

describe('FormFrame stale review and validation boundaries', () => {
  it('an aborted save cannot clear a newer review or draft, and duplicate confirm events start only one write', async () => {
    const first = deferred();
    const second = deferred();
    const signals: AbortSignal[] = [];
    const done = vi.fn();
    const save = vi.fn(async (_: V, ctx: { signal: AbortSignal }) => {
      signals.push(ctx.signal);
      await (signals.length === 1 ? first.promise : second.promise);
    });
    render(<View onSubmit={save} onSubmitted={done} />);
    await userEvent.type(screen.getByLabelText('Name'), 'old');
    await review();
    const button = within(screen.getByRole('alertdialog')).getByRole('button', { name: '确认保存' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(save).toHaveBeenCalledTimes(1);
    act(() => form.setValue('name', 'new review', { shouldDirty: true }));
    expect(signals[0].aborted).toBe(true);
    await review();
    await confirm();
    expect(save).toHaveBeenCalledTimes(2);
    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(done).not.toHaveBeenCalled();
    expect(state.readDraft('scope', 'record')).toMatchObject({ name: 'new review' });
    await act(async () => {
      second.resolve();
      await second.promise;
    });
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(form.getValues().name).toBe('new review');
  });
  for (const cause of ['edit', 'operationKey', 'readiness', 'unmount'] as const) {
    it(`old asynchronous resolver cannot reopen review or focus after ${cause}`, async () => {
      const pending = deferred();
      let started = false;
      let editor!: UseFormReturn<V>;
      const resolver: Resolver<V> = async values => {
        started = true;
        await pending.promise;
        return { values, errors: {} };
      };
      function Editor({ version = 'one', ready = true }: { version?: string; ready?: boolean }) {
        const current = useForm<V>({ defaultValues: { name: 'old', password: '' }, resolver });
        useLayoutEffect(() => {
          editor = current;
        });
        return (
          <InteractionProvider>
            <FormFrame
              form={current}
              title="Async legacy owner"
              scopeKey="async"
              draftKey="async"
              operationKey={version}
              reviewReady={ready}
              onSubmit={async () => {}}
              onCancel={() => {}}
            >
              <FormField name="name" label="Name" />
            </FormFrame>
          </InteractionProvider>
        );
      }
      const view = render(<Editor />);
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      expect(started).toBe(true);
      if (cause === 'edit') act(() => editor.setValue('name', 'new', { shouldDirty: true }));
      if (cause === 'operationKey') view.rerender(<Editor version="two" />);
      if (cause === 'readiness') view.rerender(<Editor ready={false} />);
      if (cause === 'unmount') view.unmount();
      await act(async () => {
        pending.resolve();
        await pending.promise;
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      if (cause !== 'unmount') expect(screen.getByLabelText('Name')).toHaveValue(cause === 'edit' ? 'new' : 'old');
    });
  }
});

it('restorable legacy forms optionally filter a stored draft before reset, without restoring password or unknown fields', async () => {
  function Restored() {
    const restored = useRestorableForm<V>({
      schema: z.object({ name: z.string(), password: z.string() }),
      defaultValues: { name: '', password: '' },
      scopeKey: 'scope',
      draftKey: 'restore',
      draftFilter: value => ({ name: typeof value.name === 'string' ? value.name : '' }),
    });
    useLayoutEffect(() => {
      form = restored;
    });
    return (
      <FormFrame form={restored} title="Restored" scopeKey="scope" draftKey="restore" onCancel={() => {}}>
        <FormField name="name" label="Name" />
        <FormField name="password" label="Password" type="password" />
      </FormFrame>
    );
  }
  const view = render(
    <InteractionProvider>
      <State />
    </InteractionProvider>,
  );
  act(() =>
    state.writeDraft('scope', 'restore', { name: 'draft name', password: 'never restore', injected: 'unknown' }),
  );
  view.rerender(
    <InteractionProvider>
      <State />
      <Restored />
    </InteractionProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('draft name'));
  expect(screen.getByLabelText('Password')).toHaveValue('');
  expect(form.getValues()).not.toHaveProperty('injected');
  expect(form.getValues().password).not.toBe('never restore');
  expect(form.formState.isDirty).toBe(true);
});

it('uses an external title while retaining a named form and dirty cancellation',async()=>{
 render(<View headerMode="external" onSubmit={async()=>{}} />);
 expect(screen.getByRole('form',{name:'Live editor'})).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'Live editor'})).not.toBeInTheDocument();
 expect(screen.queryByText('请核对资料后保存。')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Keep this input'}});
 fireEvent.click(screen.getByRole('button',{name:'取消'}));
 const guard=await screen.findByRole('alertdialog');
 fireEvent.click(within(guard).getByRole('button',{name:'继续编辑'}));
 expect(screen.getByLabelText('Name')).toHaveValue('Keep this input');
});

describe('optional explicit discard',()=>{
 it('keeps editing, preserves on leave, and discards only after resetting before the cancel callback',async()=>{
 const done=vi.fn(()=>{expect(form.getValues('name')).toBe('');expect(form.formState.isDirty).toBe(false);expect(state.readDraft('scope','record')).toBeUndefined();expect(state.dirty).toBe(false);});
 render(<View allowDiscard onCancel={done} draftFilter={values=>({name:values.name})}/>);
 await userEvent.type(screen.getByLabelText('Name'),'discard me');
 await userEvent.type(screen.getByLabelText('Password'),'secret');
 await userEvent.click(screen.getByRole('button',{name:'取消'}));
 let guard=await screen.findByRole('alertdialog');
 await userEvent.click(within(guard).getByRole('button',{name:'继续编辑'}));expect(done).not.toHaveBeenCalled();expect(form.getValues('name')).toBe('discard me');
 await userEvent.click(screen.getByRole('button',{name:'取消'}));guard=await screen.findByRole('alertdialog');
 expect(within(guard).getByRole('button',{name:'保留草稿并离开'})).toBeInTheDocument();
 await userEvent.click(within(guard).getByRole('button',{name:'放弃输入并离开'}));
 await waitFor(()=>expect(done).toHaveBeenCalledTimes(1));
 await act(async()=>{});expect(state.readDraft('scope','record')).toBeUndefined();
 });
 it('does not offer discard to existing callers',async()=>{
 render(<View/>);await userEvent.type(screen.getByLabelText('Name'),'retained');await userEvent.click(screen.getByRole('button',{name:'取消'}));
 expect(within(await screen.findByRole('alertdialog')).queryByRole('button',{name:'放弃输入并离开'})).not.toBeInTheDocument();
 });
});

function CoupledFixture(props:Partial<FormFrameProps<V>>) {
 const current=useForm<V>({defaultValues:{name:'',password:''}});const name=current.watch('name');
 useLayoutEffect(()=>{form=current;});
 useEffect(()=>{if(!name)current.setValue('password','',{shouldDirty:true});},[name,current]);
 return <FormFrame allowDiscard form={current} title="Coupled" scopeKey="scope" draftKey="record" operationKey={name} reviewReady={Boolean(name)} draftFilter={values=>({name:values.name})} onCancel={()=>{}} {...props}><FormField name="name" label="Name"/><FormField name="password" label="Password"/></FormFrame>;
}
function CoupledView(props:Partial<FormFrameProps<V>>) {return <InteractionProvider><State/><CoupledFixture {...props}/></InteractionProvider>;}
it('fix2 discard completes once despite input-derived readiness and key resets, then supports fresh drafts while mounted',async()=>{
 const done=vi.fn();render(<CoupledView onCancel={done}/>);await userEvent.type(screen.getByLabelText('Name'),'first');await userEvent.click(screen.getByRole('button',{name:'取消'}));await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button',{name:'放弃输入并离开'}));
 await waitFor(()=>expect(done).toHaveBeenCalledTimes(1));expect(state.readDraft('scope','record')).toBeUndefined();expect(form.formState.isDirty).toBe(false);
 await userEvent.type(screen.getByLabelText('Name'),'next input');await waitFor(()=>expect(state.readDraft('scope','record')).toMatchObject({name:'next input'}));
});
it('fix2 a real owner replacement before discard completion cannot close the new owner or erase its existing draft',async()=>{
 const done=vi.fn();const view=render(<CoupledView onCancel={done}/>);await userEvent.type(screen.getByLabelText('Name'),'old');await userEvent.click(screen.getByRole('button',{name:'取消'}));const discard=within(await screen.findByRole('alertdialog')).getByRole('button',{name:'放弃输入并离开'});
 act(()=>{fireEvent.click(discard);state.writeDraft('replacement','new-record',{name:'new owner draft'});view.rerender(<CoupledView scopeKey="replacement" draftKey="new-record" onCancel={done}/>);});
 await act(async()=>{});expect(done).not.toHaveBeenCalled();expect(state.readDraft('replacement','new-record')).toEqual({name:'new owner draft'});
});
it('fix3 permanently retires pending A discard across A to B to A while preserving later drafts and a fresh A cancellation',async()=>{
 const oldA=vi.fn(),newA=vi.fn();const view=render(<CoupledView onCancel={oldA}/>);
 await userEvent.type(screen.getByLabelText('Name'),'old A');await userEvent.click(screen.getByRole('button',{name:'取消'}));const discard=within(await screen.findByRole('alertdialog')).getByRole('button',{name:'放弃输入并离开'});
 act(()=>{fireEvent.click(discard);state.writeDraft('B','B-record',{name:'B draft'});view.rerender(<CoupledView scopeKey="B" draftKey="B-record" onCancel={oldA}/>);});
 await act(async()=>{});expect(oldA).not.toHaveBeenCalled();expect(state.readDraft('B','B-record')).toEqual({name:'B draft'});
 act(()=>{state.writeDraft('scope','record',{name:'later A draft'});view.rerender(<CoupledView onCancel={newA}/>);});
 await act(async()=>{});expect(oldA).not.toHaveBeenCalled();expect(newA).not.toHaveBeenCalled();expect(state.readDraft('scope','record')).toEqual({name:'later A draft'});expect(state.readDraft('B','B-record')).toEqual({name:'B draft'});
 await userEvent.type(screen.getByLabelText('Name'),'new A input');await waitFor(()=>expect(state.readDraft('scope','record')).toMatchObject({name:'new A input'}));
 await userEvent.click(screen.getByRole('button',{name:'取消'}));await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button',{name:'放弃输入并离开'}));await waitFor(()=>expect(newA).toHaveBeenCalledTimes(1));expect(oldA).not.toHaveBeenCalled();expect(state.readDraft('scope','record')).toBeUndefined();
 await userEvent.type(screen.getByLabelText('Name'),'after new A discard');await waitFor(()=>expect(state.readDraft('scope','record')).toMatchObject({name:'after new A discard'}));
});
it('fix3 an already completed discard cannot fire again when the same form returns to A',async()=>{
 const completed=vi.fn(),later=vi.fn();const view=render(<CoupledView onCancel={completed}/>);await userEvent.type(screen.getByLabelText('Name'),'first A');await userEvent.click(screen.getByRole('button',{name:'取消'}));await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button',{name:'放弃输入并离开'}));await waitFor(()=>expect(completed).toHaveBeenCalledTimes(1));
 view.rerender(<CoupledView scopeKey="B" draftKey="B-record" onCancel={later}/>);view.rerender(<CoupledView onCancel={later}/>);await act(async()=>{});expect(completed).toHaveBeenCalledTimes(1);expect(later).not.toHaveBeenCalled();
});
