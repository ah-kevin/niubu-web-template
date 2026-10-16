import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineNitroPlugin } from 'nitropack/runtime';
import { BodyError, readRequestBody } from '../src/body';
import { createMockBackend, failureResponse } from '../src/dispatcher';
import type { MockResponse } from '../src/dispatcher';
import { sendMockResponse } from '../src/transfers/bridge';

export default defineNitroPlugin(nitroApp => {
  const backend = createMockBackend();
  nitroApp.hooks.hook('close', () => backend.dispose());

  nitroApp.h3App.use(
    '/api',
    async event => {
      const req: IncomingMessage & { originalUrl?: string } = event.node.req;
      const res: ServerResponse = event.node.res;
      let response: MockResponse;
      try {
        // h3 removes the mount prefix from req.url; originalUrl retains /api.
        const url = new URL(req.originalUrl ?? `/api${req.url ?? '/'}`, 'http://localhost');
        const method = req.method ?? 'GET';
        // Do not destroy the IncomingMessage on overflow: the JSON 413 still needs its socket.
        const body =
          method === 'POST' || method === 'PUT'
            ? await readRequestBody(req.iterator({ destroyOnReturn: false }))
            : undefined;
        response = await backend.dispatch({
          method,
          path: url.pathname,
          query: url.searchParams,
          headers: req.headers,
          body,
        });
      } catch (error) {
        req.resume();
        response =
          error instanceof BodyError
            ? failureResponse(error.status, error.code, error.message)
            : failureResponse(400, 'INVALID_REQUEST', 'Unable to read request');
      }
      sendMockResponse(response, {
        setStatus: status => {
          res.statusCode = status;
        },
        setHeader: (name, value) => {
          res.setHeader(name, value);
        },
        end: body => {
          res.end(body);
        },
      });
    },
    { match: path => path === '/' || path.startsWith('/') },
  );

  // Nitro 2 registers its router before running plugins. Place this API layer
  // before that router so its unmatched-route fallback cannot intercept /api.
  const apiLayer = nitroApp.h3App.stack.pop();
  if (apiLayer) nitroApp.h3App.stack.unshift(apiLayer);
});
