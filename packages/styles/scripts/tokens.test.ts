import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultThemeAppearance, resolvePresentationTheme, densityTokens } from '@niubu/core-design';
import { renderTokens } from './tokens.ts';

test('static CSS retains aliases, theme selectors and independent density cascade', () => {
  const css = renderTokens(readFileSync(new URL('../src/tokens.template.css', import.meta.url), 'utf8'));
  for (const [key, value] of Object.entries(resolvePresentationTheme(defaultThemeAppearance, 'light'))) assert.ok(css.includes(`${key}: ${value};`));
  for (const [key, value] of Object.entries(resolvePresentationTheme(defaultThemeAppearance, 'dark'))) assert.ok(css.includes(`${key}: ${value};`));
  for (const tokens of Object.values(densityTokens))
    for (const [key, value] of Object.entries(tokens)) assert.ok(css.includes(`${key}: ${value};`));
  assert.ok(css.includes('--color-input: var(--control-border);'));
  assert.ok(css.includes('--color-card-foreground: var(--foreground);'));
  const dark = css.split(":root[data-theme='dark']")[1]!.split('}')[0]!;
  assert.ok(!dark.includes('--row-height') && !dark.includes('--space-page'));
  assert.ok(css.indexOf(":root[data-density='compact']") > css.indexOf(":root[data-theme='dark']"));
});

test('checking rejects stale CSS without writes; explicit generation updates only static CSS', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'niubu-tokens-'));
  try {
    mkdirSync(join(fixture, 'scripts'));
    mkdirSync(join(fixture, 'src'));
    mkdirSync(join(fixture, 'node_modules'));
    symlinkSync(
      fileURLToPath(new URL('../node_modules/@niubu', import.meta.url)),
      join(fixture, 'node_modules/@niubu'),
    );
    writeFileSync(join(fixture, 'package.json'), '{"type":"module"}');
    writeFileSync(join(fixture, 'scripts/tokens.ts'), readFileSync(new URL('./tokens.ts', import.meta.url)));
    const template = readFileSync(new URL('../src/tokens.template.css', import.meta.url), 'utf8');
    writeFileSync(join(fixture, 'src/tokens.template.css'), template);
    writeFileSync(join(fixture, 'src/tokens.css'), 'stale');
    const check = spawnSync(process.execPath, ['scripts/tokens.ts'], { cwd: fixture, encoding: 'utf8' });
    assert.notEqual(check.status, 0);
    assert.match(check.stderr, /differs from canonical/);
    assert.equal(readFileSync(join(fixture, 'src/tokens.css'), 'utf8'), 'stale');
    execFileSync(process.execPath, ['scripts/tokens.ts', '--write'], { cwd: fixture });
    assert.equal(readFileSync(join(fixture, 'src/tokens.css'), 'utf8'), renderTokens(template));
    assert.equal(readFileSync(join(fixture, 'src/tokens.template.css'), 'utf8'), template);
    execFileSync(process.execPath, ['scripts/tokens.ts'], { cwd: fixture });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('presentation typography, radius, filters and independently readable region focus have real CSS consumers', () => {
  const base = readFileSync(new URL('../src/base.css', import.meta.url), 'utf8');
  const template = readFileSync(new URL('../src/tokens.template.css', import.meta.url), 'utf8');
  assert.match(base, /font-size:\s*var\(--font-size-base\)/);
  assert.match(base, /filter:\s*var\(--presentation-filter/);
  for (const role of ['primary-text', 'primary-hover', 'primary-hover-foreground']) assert.ok(template.includes(`--color-${role}: var(--${role});`));
  for (const region of ['sidebar', 'submenu', 'header']) {
    const prefix = region === 'submenu' ? 'sidebar-submenu' : region;
    const rule = base.match(new RegExp(`\\[data-theme-region='${region}'\\]\\s*\\{([^}]+)\\}`))?.[1];
    assert.ok(rule, `actual ${region} consumer`);
    assert.ok(rule.includes(`--ring: var(--${prefix}-ring)`));
    assert.ok(rule.includes(`--primary-text: var(--${prefix}-primary-text)`));
    assert.ok(rule.includes(`--foreground: var(--${prefix}-foreground)`));
    assert.ok(rule.includes(`--accent: var(--${prefix}-accent)`));
    for (const role of ['background', 'warm', 'muted']) assert.ok(rule.includes(`--${role}: var(--${prefix}-${role})`));
  }
  for (const radius of ['sm', 'md', 'lg', 'xl']) assert.match(template, new RegExp(`--radius-${radius}:.*var\\(--radius\\)`));
  assert.doesNotMatch(base, /body\s*\{[^}]*overflow:\s*hidden/);
});
