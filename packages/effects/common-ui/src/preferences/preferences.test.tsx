import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import { corePreferenceDefaults, type CorePreferences } from '@niubu/core-preferences';
import { PreferenceDrawer, type PreferenceDrawerProps } from './PreferenceDrawer';
import { preferenceControls, preferencePatch, preferenceValue } from './control-schema';

function leafPaths(input: unknown, prefix = ''): string[] {
  return Object.entries(input as object).flatMap(([key, value]) =>
    value && typeof value === 'object' ? leafPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}
it('maps every one of the 86 effective fields to its validator and real consumer contract', () => {
  expect(preferenceControls.map(control => control.key).sort()).toEqual(leafPaths(corePreferenceDefaults).sort());
  expect(preferenceControls).toHaveLength(86);
  for (const control of preferenceControls) {
    expect(control.availability).toBe('implemented');
    expect(control.validatorReference).toMatch(/validate/);
    expect(control.consumer).toBeTruthy();
    expect(control.test).toBeTruthy();
    expect(preferencePatch(control.key, preferenceValue(corePreferenceDefaults, control.key))).not.toEqual({});
  }
  expect(preferencePatch('theme.colorPrimary', 'url(javascript:bad)')).toEqual({});
  expect(preferencePatch('layout.fixedWidth', Number.NaN)).toEqual({});
  expect(preferencePatch('__proto__.polluted', true)).toEqual({});
});
it('offers five controlled groups and submits only valid complete input', async () => {
  const user = userEvent.setup();
  const change = vi.fn(() => ({ kind: 'persisted' as const }));
  render(
    <PreferenceDrawer
      value={corePreferenceDefaults}
      onChange={change}
      onReset={() => ({ kind: 'persisted' })}
      extensions={[]}
      onClose={() => {}}
      returnFocus={() => {}}
    />,
  );
  expect(screen.getAllByRole('tab')).toHaveLength(5);
  expect(screen.getByRole('tab', { name: '外观' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: '默认蓝' })).toHaveTextContent('默认蓝');
  expect(screen.getByRole('button', { name: '自定义' })).toHaveTextContent('自定义');
  const color = screen.getByRole('textbox', { name: '自定义主色' });
  fireEvent.change(color, { target: { value: 'javascript:bad' } });
  fireEvent.blur(color);
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('有效');
  fireEvent.change(color, { target: { value: '#123456' } });
  fireEvent.blur(color);
  expect(change).toHaveBeenLastCalledWith({ theme: { preset: 'custom', colorPrimary: '#123456' } });
  await user.click(screen.getByRole('tab', { name: '布局' }));
  await user.click(screen.getByRole('switch', { name: '显示侧栏' }));
  expect(change).toHaveBeenLastCalledWith({ sidebar: { enabled: false } });
  await user.click(screen.getByRole('tab', { name: '拓展' }));
  expect(screen.getByText(/锁屏、退出登录和服务版本检查尚未接入/)).toBeVisible();
  expect(screen.queryByRole('switch', { name: /锁屏|退出登录|版本/ })).not.toBeInTheDocument();
});

function ControlledDrawer({ onChange }: Pick<PreferenceDrawerProps, 'onChange'>) {
  const [value, setValue] = useState<CorePreferences>(corePreferenceDefaults);
  return (
    <PreferenceDrawer
      value={value}
      onChange={patch => {
        setValue(previous => ({
          ...previous,
          theme: { ...previous.theme, ...patch.theme },
          layout: { ...previous.layout, ...patch.layout },
        }));
        return onChange(patch);
      }}
      onReset={() => {
        setValue(corePreferenceDefaults);
        return { kind: 'persisted' };
      }}
      extensions={[]}
      onClose={() => {}}
      returnFocus={() => {}}
    />
  );
}

it('activates custom color in the same validated patch', async () => {
  const user = userEvent.setup();
  const change = vi.fn(() => ({ kind: 'persisted' as const }));
  render(<ControlledDrawer onChange={change} />);
  expect(screen.getByRole('button', { name: '默认蓝' })).toHaveAttribute('aria-pressed', 'true');
  const color = screen.getByRole('textbox', { name: '自定义主色' });
  await user.click(color);
  await user.clear(color);
  await user.type(color, '#123456{Enter}');
  expect(change).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenLastCalledWith({ theme: { preset: 'custom', colorPrimary: '#123456' } });
  expect(screen.getByRole('button', { name: '自定义' })).toHaveAttribute('aria-pressed', 'true');
  expect(color).toHaveValue('#123456');
  change.mockClear();
  await user.click(color);
  await user.clear(color);
  await user.type(color, 'invalid{Enter}');
  expect(change).not.toHaveBeenCalled();
  expect(color).toHaveValue('invalid');
  expect(screen.getByRole('alert')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '恢复默认' }));
  expect(color).toHaveValue(corePreferenceDefaults.theme.colorPrimary);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('selects layout previews and radius choices by keyboard', async () => {
  const user = userEvent.setup();
  const change = vi.fn(() => ({ kind: 'persisted' as const }));
  render(<ControlledDrawer onChange={change} />);
  await user.click(screen.getByRole('radio', { name: '浅色' }));
  expect(change).toHaveBeenLastCalledWith({ theme: { mode: 'light' } });
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: '深色' })).toBeChecked();
  expect(change).toHaveBeenLastCalledWith({ theme: { mode: 'dark' } });
  await user.click(screen.getByRole('radio', { name: '0.25 rem' }));
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('radio', { name: '0 rem' })).toBeChecked();
  expect(change).toHaveBeenLastCalledWith({ theme: { radius: 0 } });
  await user.click(screen.getByRole('tab', { name: '布局' }));
  expect(screen.getAllByRole('radio')).toHaveLength(7);
  await user.click(screen.getByRole('radio', { name: '双列导航' }));
  expect(change).toHaveBeenLastCalledWith({ layout: { mode: 'two-column' } });
  expect(screen.getByRole('radio', { name: '双列导航' })).toBeChecked();
  await user.keyboard('{ArrowRight}');
  expect(change).toHaveBeenLastCalledWith({ layout: { mode: 'horizontal' } });
  expect(screen.getByRole('radio', { name: '水平导航' })).toBeChecked();
});

it('clears invalid field drafts on explicit reset even when effective defaults were unchanged', async () => {
  const user = userEvent.setup();
  render(
    <PreferenceDrawer
      value={corePreferenceDefaults}
      onChange={() => ({ kind: 'persisted' })}
      onReset={() => ({ kind: 'persisted' })}
      extensions={[]}
      onClose={() => {}}
      returnFocus={() => {}}
    />,
  );
  const color = screen.getByRole('textbox', { name: '自定义主色' });
  fireEvent.change(color, { target: { value: 'invalid' } });
  fireEvent.blur(color);
  expect(screen.getByRole('alert')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '恢复默认' }));
  expect(color).toHaveValue(corePreferenceDefaults.theme.colorPrimary);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: '布局' }));
  const width = screen.getByRole('spinbutton', { name: '定宽宽度（px）' });
  fireEvent.change(width, { target: { value: '12' } });
  fireEvent.blur(width);
  expect(screen.getByRole('alert')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '恢复默认' }));
  expect(width).toHaveValue(corePreferenceDefaults.layout.fixedWidth);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

import { act } from '@testing-library/react';
import { I18nProvider } from '@niubu/locales/react';
import { createI18n } from '@niubu/locales';
it('distinguishes a saved language preference from failed active-language resources', async () => {
  const i18n = createI18n({
    defaultLocale: 'zh-CN',
    appLoaders: {
      fixture: {
        fallback: {},
        load: async () => {
          throw Error('unavailable');
        },
      },
    },
  });
  render(
    <I18nProvider instance={i18n}>
      <PreferenceDrawer
        value={{ ...corePreferenceDefaults, locale: 'en-US' }}
        onChange={() => ({ kind: 'persisted' })}
        onReset={() => ({ kind: 'persisted' })}
        extensions={[]}
        onClose={() => {}}
        returnFocus={() => {}}
      />
    </I18nProvider>,
  );
  await act(() => i18n.changeLocale('en-US', ['fixture']).catch(() => {}));
  expect(i18n.getSnapshot()).toMatchObject({ preferredLocale: 'en-US', activeLocale: 'zh-CN', status: 'error' });
  expect(screen.getByRole('status')).toHaveTextContent('en-US 的语言资源未能载入');
  expect(screen.getByRole('status')).toHaveTextContent('仍使用 zh-CN');
  i18n.dispose();
});


it('binds extracted fields to their actual public preference consumers and behavior tests', () => {
  const controls = new Map(preferenceControls.map(control => [control.key, control]));
  const rootTest = 'tests/integration/preference-consumers.test.tsx';
  const check = (keys: readonly string[], consumer: string, test = rootTest) => {
    for (const key of keys) expect(controls.get(key), key).toMatchObject({ consumer, test, availability: 'implemented' });
  };
  check(['enabled', 'hideOnlyOne', 'showIcon', 'showHome', 'style'].map(key => `breadcrumb.${key}`), 'packages/effects/layouts/src/widgets/Breadcrumbs.tsx', 'packages/effects/layouts/src/widgets/Breadcrumbs.test.tsx');
  check(['persist', 'visitHistory', 'maxCount'].map(key => `tabbar.${key}`), 'packages/effects/layouts/src/routing/PageTabsBinding.tsx');
  check(['draggable', 'wheelable', 'middleClickClose', 'showIcon', 'showMore', 'showMaximize', 'showRefresh', 'style'].map(key => `tabbar.${key}`), 'packages/effects/layouts/src/routing/PageTabsView.tsx');
  check(['tabbar.enabled'], 'packages/@core/ui-kit/layout-ui/src/layout-model.ts');
  check(['search', 'preferences', 'theme', 'language', 'timezone', 'fullscreen', 'refresh', 'notification'].flatMap(widget => ['enabled', 'position'].map(key => `widget.${widget}.${key}`)), 'packages/effects/layouts/src/widgets/FoundationTools.tsx');
  check(['enabled', 'companyName', 'companyUrl', 'year', 'icpNumber', 'icpUrl'].map(key => `copyright.${key}`), 'packages/effects/layouts/src/widgets/Copyright.tsx');
  check(['general.dynamicTitle', 'transition.progress', 'transition.loading', 'transition.enabled', 'transition.style'], 'packages/effects/layouts/src/routing/RoutePresentation.tsx');
  check(['general.watermark', 'general.watermarkText'], 'packages/effects/layouts/src/widgets/Watermark.tsx');
  check(['general.displayTimeZone'], 'packages/locales/src/formatters.ts');
  check(['general.copyPreferences'], 'packages/effects/common-ui/src/preferences/PreferenceDrawer.tsx');
  check(['locale'], 'apps/playground/src/main.tsx');
});
