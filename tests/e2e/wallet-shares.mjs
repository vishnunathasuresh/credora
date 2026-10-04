import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiRoot = path.join(repoRoot, 'apps/api');
const tsxEntry = path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs');
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const { port } = probe.address();
probe.close();
await once(probe, 'close');

const child = spawn(process.execPath, [tsxEntry, 'src/index.ts'], {
  cwd: apiRoot,
  env: {
    ...process.env,
    API_PORT: String(port),
    API_DATABASE_PATH: ':memory:',
    API_ALLOWED_ORIGINS: 'http://localhost:3000',
    API_CLEANUP_INTERVAL_MS: '3600000',
    CREDENTIAL_REGISTRY_ADDRESS: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (chunk) => (logs += chunk.toString()));
child.stderr.on('data', (chunk) => (logs += chunk.toString()));
const apiUrl = `http://127.0.0.1:${port}`;

async function waitForApi() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited early:\n${logs}`);
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the local API finishes startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not become ready:\n${logs}`);
}

async function request(route, init = {}) {
  const response = await fetch(`${apiUrl}${route}`, init);
  return { response, body: await response.json() };
}

try {
  await waitForApi();
  const firstHash = `0x${'1'.repeat(64)}`;
  const secondHash = `0x${'2'.repeat(64)}`;
  const valid = (hashes, durationDays = 7) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credentialHashes: hashes, durationDays }),
  });

  const preflight = await fetch(`${apiUrl}/wallet/shares/00000000-0000-0000-0000-000000000000`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'x-share-management-token',
    },
  });
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /DELETE/);
  assert.match(
    preflight.headers.get('access-control-allow-headers') ?? '',
    /x-share-management-token/i,
  );

  const invalidDuration = await request('/wallet/shares', valid([firstHash], 2));
  assert.equal(invalidDuration.response.status, 400);
  assert.equal(invalidDuration.body.error, 'INVALID_SHARE_DURATION');

  const duplicate = await request('/wallet/shares', valid([firstHash, firstHash]));
  assert.equal(duplicate.response.status, 400);
  assert.equal(duplicate.body.error, 'INVALID_BODY');

  const created = await request('/wallet/shares', valid([firstHash, secondHash]));
  assert.equal(created.response.status, 201);
  assert.match(created.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(created.body.managementToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(created.body.token, created.body.managementToken);
  assert.ok(Date.parse(created.body.expiresAt) > Date.now() + 6 * 24 * 60 * 60_000);
  assert.ok(Date.parse(created.body.expiresAt) < Date.now() + 8 * 24 * 60 * 60_000);

  const shared = await request(`/wallet/shares/${created.body.token}`);
  assert.equal(shared.response.status, 200);
  assert.deepEqual(shared.body.credentials, [
    { credentialHash: firstHash },
    { credentialHash: secondHash },
  ]);
  assert.equal('managementToken' in shared.body, false);
  assert.equal('token' in shared.body, false);

  const denied = await request(`/wallet/shares/${created.body.id}`, {
    method: 'DELETE',
    headers: { 'x-share-management-token': 'A'.repeat(43) },
  });
  assert.equal(denied.response.status, 403);

  const revoked = await request(`/wallet/shares/${created.body.id}`, {
    method: 'DELETE',
    headers: { 'x-share-management-token': created.body.managementToken },
  });
  assert.equal(revoked.response.status, 200);

  const inactive = await request(`/wallet/shares/${created.body.token}`);
  assert.equal(inactive.response.status, 410);
  assert.equal(inactive.body.error, 'SHARE_EXPIRED');
  assert.equal(
    logs.includes(created.body.token),
    false,
    'bearer share token must not appear in API logs',
  );

  const secondShare = await request('/wallet/shares', valid([firstHash], 1));
  assert.equal(secondShare.response.status, 201);
  assert.equal(secondShare.body.durationDays, 1);

  console.log('wallet share lifecycle passed');
} finally {
  child.kill('SIGTERM');
  await once(child, 'exit');
}
