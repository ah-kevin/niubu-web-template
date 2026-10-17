import { useApplicationText } from './copy';
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
    <section className="playground-page example-page w-full min-w-0 p-[calc(var(--space-page)-8px)] [@media(max-width:700px)]:p-[16px] [&>h1]:mb-[12px] [&>h1]:text-[24px] [&>h1]:font-semibold [&>p]:my-3 [&>p]:max-w-[80ch] [&>p]:text-muted-foreground [&>p]:leading-relaxed [&_pre]:mt-4 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_output]:my-3 [&_output]:block [&_output]:whitespace-pre-wrap [&_output]:break-words [&_h2]:mb-3 [&_h2]:text-[16px] [&_h2]:font-semibold">
      <h1>{text('accessTitle')}</h1>
      <p>{text('accessHelp')}</p>
      <div className="example-toolbar my-3 flex flex-wrap items-center gap-3 [&>label]:inline-flex [&>label]:items-center [&>label]:gap-2">
        <label>
          {text('role')}
          <Select
            label={text('role')}
            value={role}
            onValueChange={setRole}
            options={roles.map(value => ({ value, label: value }))}
          />
        </label>
        <label>
          {text('scope')}
          <Select
            label={text('scope')}
            value={scopeId}
            onValueChange={setScopeId}
            options={['north', 'other'].map(value => ({ value, label: value }))}
          />
        </label>
        <label>
          <Checkbox checked={write} onCheckedChange={value => setWrite(value === true)} />
          {text('write')}
        </label>
      </div>
      {roles.map(r => (
        <p key={r}>
          {r} {text('page')}：{access.grantedPageIds.includes(`example.${r}`) ? text('allowed') : text('denied')}
        </p>
      ))}
      {!ready && <p role="status">{text('outsideScope')}</p>}
      <AccessProvider value={{ roles: [role], codes, ready }}>
        <AccessControl codes={['example:read', 'example:write']} mode="any">
          <p>{text('any')}</p>
        </AccessControl>
        <AccessControl codes={['example:read', 'example:write']} mode="all">
          <Button onClick={() => setWrite(false)}>{text('delete')}</Button>
        </AccessControl>
        <AccessControl roles={['admin', 'super']} strategy="disable">
          {({ disabled }) => <Button disabled={disabled}>{text('manage')}</Button>}
        </AccessControl>
      </AccessProvider>
    </section>
  );
}
