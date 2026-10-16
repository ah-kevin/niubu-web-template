import { readFileSync, writeFileSync } from 'node:fs';
import { defaultThemeAppearance, densityTokens, resolvePresentationTheme } from '@niubu/core-design';

const declarations = (tokens: Readonly<Record<string, string>>) =>
  Object.entries(tokens)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');
export function renderTokens(template: string): string {
  const light = { ...resolvePresentationTheme(defaultThemeAppearance, 'light'), ...densityTokens.standard };
  return template
    .replace('{{light}}', `  ${declarations(light)}`)
    .replace('{{dark}}', `  ${declarations(resolvePresentationTheme(defaultThemeAppearance, 'dark'))}`)
    .replace('{{compact}}', declarations(densityTokens.compact));
}
const target = new URL('../src/tokens.css', import.meta.url);
const rendered = renderTokens(readFileSync(new URL('../src/tokens.template.css', import.meta.url), 'utf8'));
if (process.argv.includes('--write')) {
  writeFileSync(target, rendered);
  console.log('Generated static tokens.css from @niubu/core-design.');
} else {
  if (readFileSync(target, 'utf8') !== rendered)
    throw Error(
      'tokens.css differs from canonical core-design/template; run pnpm --filter @niubu/styles tokens:generate',
    );
  console.log('Canonical theme/density CSS consistency passed (read-only).');
}
