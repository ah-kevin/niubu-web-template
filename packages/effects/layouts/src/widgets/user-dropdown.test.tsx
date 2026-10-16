import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UserDropdown } from './UserDropdown';
import { ProfileSkeleton } from './ProfileSkeleton';
it('uses real profile links and dispatches enabled actions without invoking disabled ones',async()=>{
 const lock=vi.fn(),logout=vi.fn();
 render(<UserDropdown displayName="Example user" profile={{href:'/profile?scopeKind=workspace&scopeId=north',renderLink:props=><a {...props}/>}} lock={{disabled:true,reason:'未接入',onSelect:lock}} logout={{disabled:false,onSelect:logout}}/>);
 fireEvent.keyDown(screen.getByRole('button',{name:'用户菜单'}),{key:'ArrowDown'});
 expect(await screen.findByRole('menuitem',{name:'个人中心'})).toHaveAttribute('href','/profile?scopeKind=workspace&scopeId=north');
 const item=screen.getByRole('menuitem',{name:'锁屏'});expect(item).toHaveAttribute('aria-disabled','true');fireEvent.click(item);expect(lock).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('menuitem',{name:'登出'}));expect(logout).toHaveBeenCalledOnce();
});
it('marks the profile skeleton as not connected to editing',()=>{
 render(<ProfileSkeleton displayName="Example user"/>);
 expect(screen.getByRole('heading',{name:'个人中心'})).toBeVisible();expect(screen.getByText('Example user')).toBeVisible();expect(screen.getByText('个人资料编辑尚未接入。')).toBeVisible();expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
