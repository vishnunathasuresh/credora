import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';

const port = Number(process.env.API_OUTAGE_TEST_PORT ?? 4401);
const child = spawn(
  process.execPath,
  [resolve(process.cwd(), '../../node_modules/tsx/dist/cli.mjs'), 'src/index.ts'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_PORT: String(port),
      API_DATABASE_PATH: ':memory:',
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
  const response = await fetch(`http://127.0.0.1:${port}/readyz`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).reason, 'LEDGER_UNAVAILABLE');
  const verify = await fetch(`http://127.0.0.1:${port}/credentials/0x${'00'.repeat(32)}/verify`);
  assert.equal(verify.status, 503);
  assert.equal((await verify.json()).error, 'LEDGER_UNAVAILABLE');
  const account = privateKeyToAccount(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  );
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
  const auth = await authResponse.json();
  const projectionHeaders = { authorization: `Bearer ${auth.token}` };
  const issuances = await fetch(`http://127.0.0.1:${port}/issuances`, {
    headers: projectionHeaders,
  });
  assert.equal(issuances.status, 403);
  assert.equal((await issuances.json()).error, 'FORBIDDEN');
  const credentials = await fetch(`http://127.0.0.1:${port}/credentials`, {
    headers: projectionHeaders,
  });
  assert.equal(credentials.status, 200);
  assert.deepEqual((await credentials.json()).items, []);
  const superadmin = await fetch(`http://127.0.0.1:${port}/superadmin/overview`, {
    headers: projectionHeaders,
  });
  assert.equal(superadmin.status, 403);
  const organization = await fetch(`http://127.0.0.1:${port}/org/overview`, {
    headers: projectionHeaders,
  });
  assert.equal(organization.status, 403);
  console.log(JSON.stringify({ ok: true, case: 'ledger outage' }, null, 2));
} finally {
  child.kill();
}
