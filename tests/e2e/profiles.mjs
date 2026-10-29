import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { privateKeyToAccount } from 'viem/accounts';

const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const { port } = probe.address();
probe.close();
await once(probe, 'close');
const tempDir = mkdtempSync(join(tmpdir(), 'credora-profiles-'));
const databasePath = join(tempDir, 'api.sqlite');
const child = spawn(process.execPath, ['../../node_modules/tsx/dist/cli.mjs', 'src/index.ts'], {
  cwd: 'apps/api',
  env: {
    ...process.env,
    API_PORT: String(port),
    API_DATABASE_PATH: databasePath,
    CREDENTIAL_REGISTRY_ADDRESS: '',
    API_RATE_LIMIT_MAX: '1000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stderr.on('data', (chunk) => (logs += chunk));
const base = `http://127.0.0.1:${port}`;
async function request(path, method = 'GET', body, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
async function session(account) {
  const challenge = await request('/auth/challenge', 'POST', { address: account.address });
  const signature = await account.signMessage({ message: challenge.body.message });
  return (await request('/auth/verify', 'POST', { address: account.address, signature })).body
    .token;
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  const accountA = privateKeyToAccount(`0x${'1'.repeat(64)}`);
  const accountB = privateKeyToAccount(`0x${'2'.repeat(64)}`);
  const a = await session(accountA);
  const b = await session(accountB);
  const preflight = await fetch(base + '/profile', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'PUT' },
  });
  assert.match(preflight.headers.get('access-control-allow-methods'), /PUT/);
  const db = new DatabaseSync(databasePath);
  const ownHash = `0x${'b'.repeat(64)}`;
  const otherHash = `0x${'c'.repeat(64)}`;
  const insert = db.prepare(
    "INSERT INTO issuances (id, issuer, learner, skill_name, skill_level, issue_date, credential_hash, state, created_at) VALUES (?, ?, ?, 'Course', '1', '2026-01-01', ?, 'confirmed', '2026-01-01')",
  );
  insert.run('one', accountB.address, accountA.address, ownHash);
  insert.run('two', accountA.address, accountB.address, otherHash);
  db.close();
  const input = {
    handle: 'Alice',
    name: 'Alice',
    headline: 'Researcher',
    bio: 'Hello',
    links: ['https://example.com'],
    credentialHashes: [],
    published: false,
  };
  assert.equal((await request('/profile', 'PUT', input)).status, 401);
  const created = await request('/profile', 'PUT', input, a);
  assert.equal(created.status, 200);
  assert.equal(created.body.profile.handle, 'alice');
  assert.equal((await request('/profiles/alice')).status, 404);
  assert.equal((await request('/profile', 'PUT', { ...input, handle: 'ALICE' }, b)).status, 409);
  assert.equal((await request('/profile', 'PUT', { ...input, handle: 'admin' }, b)).status, 400);
  assert.equal(
    (await request('/profile', 'PUT', { ...input, handle: 'alice2' }, a)).body.error,
    'HANDLE_COOLDOWN',
  );
  assert.equal(
    (
      await request(
        '/profile',
        'PUT',
        { ...input, credentialHashes: [`0x${'a'.repeat(64)}`], published: true },
        a,
      )
    ).body.error,
    'INVALID_PROFILE_SELECTION',
  );
  assert.equal((await request('/profiles/alice')).status, 404);
  assert.equal(
    (
      await request(
        '/profile',
        'PUT',
        { ...input, credentialHashes: [otherHash], published: true },
        a,
      )
    ).body.error,
    'INVALID_PROFILE_SELECTION',
  );
  const published = await request(
    '/profile',
    'PUT',
    { ...input, credentialHashes: [ownHash], published: true },
    a,
  );
  assert.equal(published.body.profile.id, created.body.profile.id);
  const publicView = await request('/profiles/alice');
  assert.equal(publicView.status, 200);
  assert.equal(publicView.body.profile.name, 'Alice');
  assert.deepEqual(publicView.body.profile.credentialHashes, [ownHash]);
  assert.equal('handleChangedAt' in publicView.body.profile, false);
  assert.equal('token' in publicView.body.profile, false);
  await request('/profile', 'PUT', input, a);
  assert.equal((await request('/profiles/alice')).status, 404);
  console.log('Profile privacy, authorization, handle and selection checks passed');
} finally {
  child.kill();
  await once(child, 'exit');
  rmSync(tempDir, { recursive: true, force: true });
}
