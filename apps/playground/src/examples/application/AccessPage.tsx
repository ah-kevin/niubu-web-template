import { useApplicationText } from './copy';
import { useState } from 'react';
import { resolveAccess } from '@niubu/access';
import { AccessControl, AccessProvider } from '@niubu/access/react';
import type { RouteMeta } from '@niubu/types';
import { Button } from '@niubu/shadcn-ui/button';

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
    <section className="playground-page example-page">
      <h1>{text('accessTitle')}</h1>
      <p>{text('accessHelp')}</p>
      <div className="example-toolbar">
        <label>
          {text('role')}
          <select value={role} onChange={e => setRole(e.target.value)}>
            {roles.map(r => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          {text('scope')}
          <select value={scopeId} onChange={e => setScopeId(e.target.value)}>
            <option>north</option>
            <option>other</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={write} onChange={e => setWrite(e.target.checked)} />
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
