import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { BaseControlPage } from './BaseControlPage';
import { controlGalleryTitles, type ControlGalleryKind } from './control-kinds';
import { ControlGallery } from './ControlGallery';
import { I18nProvider } from '@niubu/locales/react';
import { createPlaygroundI18n } from '../../locales';

it.each(Object.keys(controlGalleryTitles) as ControlGalleryKind[])('mounts only the %s example section', kind => {
  const { container } = render(<BaseControlPage kind={kind} />);
  const sections = container.querySelectorAll('section.example-card');
  expect(sections).toHaveLength(1);
  expect(within(sections[0] as HTMLElement).getByRole('heading')).toHaveTextContent(kind === 'Divider' ? 'Divider / Separator' : kind);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('keeps the original gallery default as all sixteen sections', () => {
  const { container } = render(<ControlGallery />);
  expect(container.querySelectorAll('section.example-card')).toHaveLength(16);
});

it('shares one live FormField owner for validation, disabled state and submission', async () => {
  const { container } = render(<BaseControlPage kind="FormField" />);
  expect(container.querySelectorAll('form')).toHaveLength(1);
  expect(container.querySelectorAll('section.example-card')).toHaveLength(1);
  const name = screen.getByRole('textbox', { name: 'Name' });
  const email = screen.getByRole('textbox', { name: 'Email' });
  fireEvent.click(screen.getByRole('button', { name: 'Submit example' }));
  expect(await screen.findByText('Enter a name')).toBeVisible();
  await userEvent.type(name, 'Ada');
  await userEvent.type(email, 'ada@example.test');
  fireEvent.click(screen.getByRole('button', { name: 'Disable controls' }));
  expect(name).toBeDisabled();
  expect(email).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Disable controls' }));
  expect(name).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit example' }));
  expect(await screen.findByText('Submitted: Ada')).toBeVisible();
  expect(container.querySelectorAll('form')).toHaveLength(1);
});


it('keeps FormField mounted and responsive through rerenders, locale changes and disabled updates', async () => {
  const i18n = createPlaygroundI18n('zh-CN', { lang: 'zh-CN', dir: 'ltr' });
  await i18n.changeLocale('zh-CN', i18n.requiredNamespaces);
  const view = render(<I18nProvider instance={i18n}><BaseControlPage kind="FormField" /></I18nProvider>);
  try {
    const name = screen.getByRole('textbox', { name: '姓名' });
    const email = screen.getByRole('textbox', { name: '邮箱' });
    await userEvent.type(name, 'Ada');
    await userEvent.type(email, 'ada@example.test');
    view.rerender(<I18nProvider instance={i18n}><BaseControlPage kind="FormField" /></I18nProvider>);
    expect(screen.getByRole('textbox', { name: '姓名' })).toBe(name);
    fireEvent.click(screen.getByRole('button', { name: '禁用控件' }));
    expect(name).toBeDisabled();
    await act(() => i18n.changeLocale('en-US', i18n.requiredNamespaces));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name);
    expect(name).toHaveValue('Ada');
    expect(name).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBe(email);
    fireEvent.click(screen.getByRole('button', { name: 'Disable controls' }));
    expect(name).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Submit example' }));
    expect(await screen.findByText('Submitted: Ada')).toBeVisible();
    expect(view.container.querySelectorAll('form')).toHaveLength(1);
  } finally { view.unmount(); i18n.dispose(); }
});
