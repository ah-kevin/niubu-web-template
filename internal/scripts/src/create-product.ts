import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { applyProduct, planProduct } from './product-generator.ts';

export function createProductCommand(args: string[], sourceRoot = process.cwd()): void {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      'target-dir': { type: 'string' },
      'product-slug': { type: 'string' },
      'name-zh': { type: 'string' },
      'name-en': { type: 'string' },
      'package-name': { type: 'string' },
      'default-locale': { type: 'string' },
      'public-scope': { type: 'string' },
      'template-ref': { type: 'string' },
      apply: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'create:product --target-dir PATH --product-slug SLUG --name-zh NAME --name-en NAME [--public-scope @scope] [--template-ref REF] [--apply|--dry-run]\nDefaults to dry-run; no install, services or Git operations.',
    );
    return;
  }
  if (
    positionals.some(value => value !== '--') ||
    !values['target-dir'] ||
    !values['product-slug'] ||
    !values['name-zh'] ||
    !values['name-en'] ||
    (values.apply && values['dry-run'])
  )
    throw new Error('Invalid product arguments; see --help');
  const plan = planProduct({
    sourceRoot,
    targetDir: values['target-dir'],
    productSlug: values['product-slug'],
    displayNameZh: values['name-zh'],
    displayNameEn: values['name-en'],
    packageName: values['package-name'],
    defaultLocale: values['default-locale'],
    publicScope: values['public-scope'],
    templateRef: values['template-ref'],
  });
  if (values.apply) applyProduct(plan);
  console.log(
    JSON.stringify(
      {
        mode: values.apply ? 'generated' : 'dry-run',
        target: plan.targetDir,
        manifest: plan.manifest,
        next: 'Review source manifest; install dependencies separately, format product text, then run check/format:check. No install, service or Git operation was performed.',
      },
      null,
      2,
    ),
  );
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    createProductCommand(process.argv.slice(2));
  } catch (error) {
    console.error('PRODUCT_GENERATION_FAILED:', error instanceof Error ? error.message : 'Unknown failure');
    process.exitCode = 1;
  }
}
