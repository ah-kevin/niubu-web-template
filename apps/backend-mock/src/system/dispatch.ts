import { parseBody } from '../body';
import type { MockRequest } from '../dispatcher';
import type { SystemResource } from './contracts';
import type { SystemRepository } from './repository';
import { SystemError, validateQuery } from './validation';

export interface SystemRoute {
  resource: SystemResource;
  id?: string;
  methods: readonly string[];
}
export function matchSystemRoute(path: string): SystemRoute | null {
  const match = /^\/api\/system\/(users|roles|menus|departments)(?:\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,127}))?$/.exec(path);
  if (!match) return null;
  return {
    resource: match[1] as SystemResource,
    id: match[2],
    methods: match[2] ? ['GET', 'PUT', 'DELETE'] : ['GET', 'POST'],
  };
}
/** The caller has authenticated the session; grants must come from that fixed profile. */
export function dispatchSystem(
  repository: SystemRepository,
  route: SystemRoute,
  request: MockRequest,
  query: URLSearchParams,
  profile: { memberships: readonly { id: string }[]; codesFor: (workspace: 'north' | 'south') => readonly string[] },
): unknown {
  const validated = validateQuery(route.resource, query, request.method === 'GET' && !route.id);
  const { workspace } = validated;
  if (!profile.memberships.some(membership => membership.id === workspace))
    throw new SystemError(403, 'UNKNOWN_SCOPE', 'Unknown workspace scope');
  const capability = request.method === 'GET' ? 'read' : 'write';
  if (!profile.codesFor(workspace).includes(`system:${route.resource}:${capability}`))
    throw new SystemError(403, 'FORBIDDEN', 'System capability required');
  switch (request.method) {
    case 'GET':
      if (route.id) return repository.get(workspace, route.resource, route.id);
      return validated.mode === 'tree'
        ? repository.tree(workspace, validated.resource)
        : repository.list(workspace, route.resource, validated.listQuery);
    case 'POST':
      return repository.create(workspace, route.resource, parseBody(request.body));
    case 'PUT':
      return repository.update(workspace, route.resource, route.id!, parseBody(request.body));
    case 'DELETE':
      return repository.remove(workspace, route.resource, route.id!);
    default:
      throw new SystemError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
}
