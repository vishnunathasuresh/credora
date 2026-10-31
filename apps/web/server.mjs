import { serve } from 'srvx';
import { staticMiddleware } from 'srvx/static';
import { fileURLToPath } from 'node:url';
import serverEntry from './dist/server/server.js';

const legacySharePath = /^\/share\/([A-Za-z0-9_-]{43})\/?$/;

const redirectLegacyShare = async (request, next) => {
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(legacySharePath);
  if (match && request.method === 'GET')
    return new Response(null, {
      status: 303,
      headers: {
        location: `/share#${match[1]}`,
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      },
    });
  return next();
};

const portArg = process.argv.indexOf('--port');
const port = process.env.PORT ?? (portArg >= 0 ? process.argv[portArg + 1] : undefined) ?? 3000;
// Use srvx programmatic API: its CLI injects an access logger that prints request.url verbatim.
const server = serve({
  fetch: serverEntry.fetch,
  port,
  hostname: process.env.HOST ?? '0.0.0.0',
  silent: true,
  middleware: [
    redirectLegacyShare,
    staticMiddleware({ dir: fileURLToPath(new URL('./dist/client/', import.meta.url)) }),
  ],
  error: (error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'web_request_failed',
        error: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return new Response('The web request could not be completed.', { status: 500 });
  },
});

await server.ready();
console.log(JSON.stringify({ level: 'info', event: 'web_started', port }));
