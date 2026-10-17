import { useApplicationText } from './copy';
import { ExampleDetails, ExamplePage, ExampleSection } from '../ExamplePage';
import { Badge } from '@niubu/shadcn-ui/badge';
import { useState } from 'react';
import { resolveAccess } from '@niubu/access';
import { AccessControl, AccessProvider } from '@niubu/access/react';
import type { RouteMeta } from '@niubu/types';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Select } from '@niubu/shadcn-ui/select';

const roles = ['admin', 'super', 'user'] as const;
const routes = roles.map((role, order) => ({
  id: `example.${role}`,
  path: `/example/${role}`,
  titleKey: role,
  iconToken: 'home',
  order,
  navigation: true,
  scope: 'workspace',
  capability: null,
  requiredRoles: [role],
  requiredCodes: ['example:read'],
})) satisfies RouteMeta[];
/** Synthetic projection, deliberately independent of the signed-in app session. */
export function AccessPage() {
  const text = useApplicationText();
  const [role, setRole] = useState<string>('admin');
  const [write, setWrite] = useState(false);
  const [scopeId, setScopeId] = useState('north');
  const codes = write ? ['example:read', 'example:write'] : ['example:read'];
  const access = resolveAccess({
    mode: 'frontend',
    routes,
    roles: [role],
    codes,
    authenticated: true,
    access: { scopes: [{ kind: 'workspace', id: 'north' }], capabilities: codes },
    scope: { kind: 'workspace', id: scopeId },
    baseURL: 'https://example.invalid',
  });
  const ready = scopeId === 'north';
  return (
    <ExamplePage title={text('accessTitle')} description={text('accessIntro')}>
      <div className="grid min-w-0 gap-[var(--workspace-section-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ExampleSection title={text('accessSettings')} description={text('accessSettingsIntro')}>
          <label className="grid gap-2 text-sm">
            {text('role')}
            <Select
              label={text('role')}
              value={role}
              onValueChange={setRole}
              options={roles.map(value => ({ value, label: value }))}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {text('scope')}
            <Select
              label={text('scope')}
              value={scopeId}
              onValueChange={setScopeId}
              options={['north', 'other'].map(value => ({ value, label: value }))}
            />
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border px-3 py-3 text-sm">
            <Checkbox checked={write} onCheckedChange={value => setWrite(value === true)} />
            {text('write')}
          </label>
        </ExampleSection>
        <ExampleSection title={text('accessPreview')} description={text('accessPreviewIntro')}>
          <div className="grid gap-3 sm:grid-cols-3">
            {roles.map(r => {
              const granted = access.grantedPageIds.includes(`example.${r}`);
              return (
                <p
                  key={r}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4 text-sm"
                >
                  <Badge variant={granted ? 'default' : 'secondary'}>
                    {r} {text('page')}：{granted ? text('allowed') : text('denied')}
                  </Badge>
                </p>
              );
            })}
          </div>
          {!ready && (
            <p
              role="status"
              className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive"
            >
              {text('outsideScope')}
            </p>
          )}
          <div className="flex min-h-20 flex-wrap items-center gap-3 rounded-md bg-muted/30 p-4">
            <AccessProvider value={{ roles: [role], codes, ready }}>
              <AccessControl codes={['example:read', 'example:write']} mode="any">
                <p className="w-full text-sm text-muted-foreground">{text('any')}</p>
              </AccessControl>
              <AccessControl codes={['example:read', 'example:write']} mode="all">
                <Button onClick={() => setWrite(false)}>{text('delete')}</Button>
              </AccessControl>
              <AccessControl roles={['admin', 'super']} strategy="disable">
                {({ disabled }) => (
                  <Button variant="outline" disabled={disabled}>
                    {text('manage')}
                  </Button>
                )}
              </AccessControl>
            </AccessProvider>
          </div>
        </ExampleSection>
      </div>
      <ExampleDetails title={text('implementation')}>
        <p>{text('accessHelp')}</p>
      </ExampleDetails>
    </ExamplePage>
  );
}
