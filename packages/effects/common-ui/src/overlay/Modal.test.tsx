import { render } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import { Modal } from './Modal';
import type { OverlayProps } from './types';
const frame=vi.hoisted(()=>vi.fn());
vi.mock('./OverlayFrame',()=>({OverlayFrame:(props:OverlayProps & {variant:string;size?:string})=>{frame(props);return props.children;}}));
it('forwards optional wide sizing and fullscreen while leaving an omitted size unspecified',()=>{
 const close=vi.fn();const view=render(<Modal open onOpenChange={close} title="Default">Content</Modal>);
 expect(frame.mock.calls.at(-1)?.[0]).toMatchObject({variant:'modal',open:true});expect(frame.mock.calls.at(-1)?.[0].size).toBeUndefined();
 view.rerender(<Modal open size="wide" fullscreen onOpenChange={close} title="Wide">Content</Modal>);
 expect(frame.mock.calls.at(-1)?.[0]).toMatchObject({variant:'modal',size:'wide',fullscreen:true});
});
