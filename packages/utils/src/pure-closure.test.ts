import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('loads the public utils closure in Node without DOM, React or storage', async () => {
  const utils = await import('@niubu/utils');
  expect(utils.businessDateAt('2026-10-10T23:30:00Z', 'Asia/Shanghai')).toBe('2026-10-11');
  const seen = new Set<string>();
  const imports = new Set<string>();
  function visit(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function node(child: ts.Node) {
      if (ts.isIdentifier(child)) expect(['window', 'document', 'localStorage', 'sessionStorage']).not.toContain(child.text);
      if ((ts.isImportDeclaration(child) || ts.isExportDeclaration(child)) && child.moduleSpecifier && ts.isStringLiteral(child.moduleSpecifier)) {
        if (ts.isExportDeclaration(child) ? child.isTypeOnly : child.importClause?.isTypeOnly) return;
        const target = child.moduleSpecifier.text;
        imports.add(target);
        if (target.startsWith('.')) visit(resolve(dirname(file), target + (extname(target) ? '' : '.ts')));
        else if (target.startsWith('@niubu/')) visit(fileURLToPath(import.meta.resolve(target)));
      }
      ts.forEachChild(child, node);
    }
    node(ast);
  }
  visit(fileURLToPath(import.meta.resolve('@niubu/utils')));
  expect([...imports].join(' ')).not.toMatch(/react|shadcn|common-ui|plugins|stores/);
  expect(typeof globalThis).toBe('object');
});
