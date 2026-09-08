import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';

const port = Number(process.env.API_ROLE_TEST_PORT ?? 4402);
const superadmin = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);
const orgAdmin = privateKeyToAccount(
  '0x0000000000000000000000000000000000000000000000000000000000000002',
);
const learner = privateKeyToAccount(
  '0x0000000000000000000000000000000000000000000000000000000000000003',
);

const child = spawn(
  process.execPath,
  [resolve(process.cwd(), '../../node_modules/tsx/dist/cli.mjs'), 'src/index.ts'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_PORT: String(port),
      API_DATABASE_PATH: ':memory:',
      API_SUPERADMIN_ADDRESSES: superadmin.address,
      API_ORG_ADMIN_ADDRESSES: orgAdmin.address,
      CREDENTIAL_REGISTRY_ADDRESS: '',
      IPFS_UPLOAD_URL: '',
      API_CLEANUP_INTERVAL_MS: '60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let output = '';
child.stdout.on('data', (chunk) => (output += chunk));
child.stderr.on('data', (chunk) => (output += chunk));

async function authenticate(account) {
  const challengeResponse = await fetch(`http://127.0.0.1:${port}/auth/challenge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: account.address }),
  });
  const challenge = await challengeResponse.json();
  const signature = await account.signMessage({ message: challenge.message });
  const authResponse = await fetch(`http://127.0.0.1:${port}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: account.address, signature }),
  });
  assert.equal(authResponse.status, 200);
  return authResponse.json();
}

async function get(path, token) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, `API did not start: ${output}`);

  const superadminAuth = await authenticate(superadmin);
  const orgAdminAuth = await authenticate(orgAdmin);
  const learnerAuth = await authenticate(learner);
  assert.ok(superadminAuth.roles.includes('SUPERADMIN'));
  assert.ok(orgAdminAuth.roles.includes('ORG_ADMIN'));
  assert.ok(learnerAuth.roles.includes('LEARNER'));

  assert.equal((await get('/superadmin/overview', superadminAuth.token)).status, 200);
  assert.equal((await get('/org/overview', superadminAuth.token)).status, 403);
  assert.equal((await get('/org/overview', orgAdminAuth.token)).status, 200);
  assert.equal((await get('/superadmin/overview', orgAdminAuth.token)).status, 403);
  assert.equal((await get('/credentials', learnerAuth.token)).status, 200);
  assert.equal((await get('/issuances', learnerAuth.token)).status, 403);
  assert.equal((await get('/org/overview', learnerAuth.token)).status, 403);
  assert.equal((await get('/superadmin/overview', learnerAuth.token)).status, 403);

  console.log(JSON.stringify({ ok: true, case: 'role matrix' }, null, 2));
} finally {
  child.kill();
}
