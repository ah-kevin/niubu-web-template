import { fireEvent, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useShellShortcuts } from './useShellShortcuts';
it('pauses existing shortcut actions without changing persisted preferences or registering duplicates',()=>{
 const search=vi.fn();
 const {rerender}=renderHook(({enabled})=>useShellShortcuts({search},{enabled}),{initialProps:{enabled:false}});
 const key={key:'k',...(/Mac|iPhone|iPad|iPod/i.test(navigator.platform)?{metaKey:true}:{ctrlKey:true})};
 fireEvent.keyDown(window,key);expect(search).not.toHaveBeenCalled();
 rerender({enabled:true});fireEvent.keyDown(window,key);expect(search).toHaveBeenCalledOnce();
 rerender({enabled:false});fireEvent.keyDown(window,key);expect(search).toHaveBeenCalledOnce();
});
