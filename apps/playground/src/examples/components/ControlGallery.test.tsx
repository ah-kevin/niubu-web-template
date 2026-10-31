import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { I18nProvider } from '@niubu/locales/react';
import { createPlaygroundI18n } from '../../locales';
import { selectOption } from '../../tests/select-option';
import { ControlGallery } from './ControlGallery';
beforeAll(()=>vi.stubGlobal('ResizeObserver',class { observe(){} unobserve(){} disconnect(){} }));
afterAll(()=>vi.unstubAllGlobals());
it('exposes all sixteen controls with local theme/density/state switches and working interactions', async()=>{
 const rootTheme=document.documentElement.getAttribute('data-theme');
 const rootDensity=document.documentElement.getAttribute('data-density');
 render(<ControlGallery/>);
 for (const name of ['Button','Input','Textarea','NumberInput','Select','Checkbox','Radio','Switch','Slider','Tabs','Badge','Card','Divider / Separator','Pagination','ScrollArea','Label']) expect(screen.getByRole('region',{name})).toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Dark'}));
 await userEvent.click(screen.getByRole('button',{name:'Compact'}));
 const gallery=screen.getByRole('region',{name:'16 basic controls'});
 expect(gallery).toHaveAttribute('data-theme','dark');expect(gallery).toHaveAttribute('data-density','compact');
 expect(gallery.style.getPropertyValue('--control-check-size')).toBe('14px');
 expect(document.documentElement.getAttribute('data-theme')).toBe(rootTheme);expect(document.documentElement.getAttribute('data-density')).toBe(rootDensity);
 await userEvent.type(screen.getByRole('textbox',{name:'Example name'}),'Sample');
 expect(screen.getByRole('textbox',{name:'Example name'})).toHaveValue('Sample');
 await userEvent.click(screen.getByRole('button',{name:'Increase quantity'}));expect(screen.getByRole('spinbutton',{name:'Quantity'})).toHaveValue(3);
 await selectOption(screen.getByRole('combobox',{name:'Example option'}),'Option B');expect(screen.getByRole('combobox')).toHaveTextContent('Option B');
 await userEvent.click(screen.getByRole('checkbox',{name:'Subscribe to updates'}));expect(screen.getByRole('checkbox',{name:'Subscribe to updates'})).toBeChecked();
 await userEvent.click(screen.getByRole('radio',{name:'Detailed view'}));expect(screen.getByRole('radio',{name:'Detailed view'})).toBeChecked();
 await userEvent.click(screen.getByRole('switch',{name:'Enable reminders'}));expect(screen.getByRole('switch',{name:'Enable reminders'})).not.toBeChecked();
 const slider=screen.getByRole('slider',{name:'Completion percentage'});slider.focus();await userEvent.keyboard('{ArrowRight}');expect(slider).toHaveAttribute('aria-valuenow','41');
 const line=screen.getByRole('tablist',{name:'Line tabs'});await userEvent.click(within(line).getByRole('tab',{name:'Details'}));expect(within(line).getByRole('tab',{name:'Details'})).toHaveAttribute('aria-selected','true');
 await userEvent.click(screen.getByRole('button',{name:'Add notifications'}));await userEvent.click(screen.getByRole('button',{name:'Add notifications'}));expect(screen.getByText('99+')).toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Select card'}));expect(screen.getByRole('button',{name:'Clear card selection'}).closest('[data-slot=card]')).toHaveAttribute('data-state','selected');
 await userEvent.click(screen.getByRole('link',{name:'Next'}));expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
 await userEvent.click(screen.getByRole('switch',{name:'Show errors'}));expect(screen.getByRole('textbox',{name:'Example name'})).toHaveAttribute('aria-invalid','true');
 await userEvent.click(screen.getByRole('switch',{name:'Loading buttons'}));expect(screen.getByRole('button',{name:'Primary'})).toBeDisabled();expect(screen.getByRole('button',{name:'Primary'})).toHaveAttribute('aria-busy','true');
 await userEvent.click(screen.getByRole('switch',{name:'Disable controls'}));expect(screen.getByRole('spinbutton',{name:'Quantity'})).toBeDisabled();expect(slider).toHaveAttribute('data-disabled');
});
it('switches bilingual labels without replacing numeric drafts or selected states',async()=>{
 const i18n=createPlaygroundI18n('zh-CN',{lang:'zh-CN',dir:'ltr'});await i18n.changeLocale('zh-CN',i18n.requiredNamespaces);
 const view=render(<I18nProvider instance={i18n}><ControlGallery/></I18nProvider>);
 try {
 const draft=screen.getByRole('spinbutton',{name:'字符串数字草稿'});fireEvent.change(draft,{target:{value:'02.30'}});
 await userEvent.click(screen.getByRole('checkbox',{name:'订阅更新'}));
 await act(()=>i18n.changeLocale('en-US',i18n.requiredNamespaces));
 expect(screen.getByRole('spinbutton',{name:'String numeric draft'})).toBe(draft);expect(draft).toHaveValue(2.3);expect(screen.getByRole('checkbox',{name:'Subscribe to updates'})).toBeChecked();
 expect(screen.getByRole('button',{name:'Increase draft value'})).toBeInTheDocument();
 } finally {view.unmount();i18n.dispose();}
});
