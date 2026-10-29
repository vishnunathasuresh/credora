import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function scanClient(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scanClient(path);
    else if (/\.(js|mjs|html|json|map)$/.test(entry.name)) {
      const source = await readFile(path, 'utf8');
      for (const secret of [
        'IPFS_GATEWAY_AUTH_TOKEN',
        'IPFS_UPLOAD_AUTH_TOKEN',
        'ANVIL_ISSUER_PRIVATE_KEY',
        'SIGNING_PRIVATE_KEY',
      ]) {
        assert.ok(!source.includes(secret), `Server-only identifier ${secret} in ${entry.name}`);
      }
    }
  }
}
await scanClient(join(root, 'apps/web/dist/client'));

const probe = createServer().listen(0, '127.0.0.1');
await once(probe, 'listening');
const { port } = probe.address();
probe.close();
await once(probe, 'close');
const server = spawn('pnpm', ['--filter', '@credora/web', 'start', '--port', String(port)], {
  cwd: root,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
});
let logs = '';
server.stdout.on('data', (chunk) => {
  logs += chunk;
});
server.stderr.on('data', (chunk) => {
  logs += chunk;
});
const base = `http://127.0.0.1:${port}`;
async function page(path) {
  const response = await fetch(base + path);
  return { response, html: await response.text() };
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Web server exited: ${logs}`);
    try {
      ready = (await fetch(base + '/api/health')).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Web server did not start: ${logs}`);
  const health = await fetch(base + '/api/health');
  assert.deepEqual(await health.json(), { ok: true, service: 'credora-web' });
  const manifest = await fetch(base + '/manifest.webmanifest');
  assert.match(manifest.headers.get('content-type') ?? '', /application\/manifest\+json/);
  assert.equal((await manifest.json()).display, 'standalone');

  const routes = [
    ['/', /home-hero/],
    ['/verify', /verify-form/],
    ['/wallet', /My credentials/],
    ['/profile', /Edit your profile/],
    ['/dashboard', /Your workspaces/],
    ['/issuer', /Issue a credential/],
    ['/org', /Organization workspace/],
    ['/admin', /Protocol administration/],
    ['/superadmin', /Protocol administration/],
    ['/u/test-profile', /public-profile-page/],
  ];
  for (const [path, content] of routes) {
    const { response, html } = await page(path);
    assert.equal(response.status, 200, path);
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];
    assert.ok(main, `Missing main content on ${path}`);
    assert.match(main, content, `Wrong route content on ${path}`);
  }
  // Regression: a nested /verify layout once hid its child result behind the form.
  const detail = await page('/verify/not-a-hash');
  assert.equal(detail.response.status, 200);
  assert.match(detail.html, /Reference not understood/);
  assert.match(detail.html, /not-a-hash/);
  assert.doesNotMatch(detail.html, /class="verify-form"/);

  for (const token of ['invalid-short', 'a'.repeat(43)]) {
    const { response, html } = await page('/share/' + token);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    if (token === 'invalid-short') assert.match(html, /Share code not understood/);
  }
  assert.equal((await fetch(base + '/unknown-route-for-e2e')).status, 404);
  console.log('Built web routes, detail rendering, share privacy and client boundaries passed.');
} finally {
  if (server.pid && server.exitCode === null) {
    const exited = once(server, 'exit');
    process.kill(-server.pid, 'SIGTERM');
    const deadline = setTimeout(() => {
      if (server.exitCode === null) {
        try {
          process.kill(-server.pid, 'SIGKILL');
        } catch {
          /* exited */
        }
      }
    }, 3000);
    await exited;
    clearTimeout(deadline);
  }
}
