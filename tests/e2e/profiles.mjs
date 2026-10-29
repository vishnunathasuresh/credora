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
  const ownHash2 = `0x${'e'.repeat(64)}`;
  const otherHash = `0x${'c'.repeat(64)}`;
  const insert = db.prepare(
    "INSERT INTO issuances (id, issuer, learner, skill_name, skill_level, issue_date, credential_hash, state, created_at) VALUES (?, ?, ?, 'Course', '1', '2026-01-01', ?, 'confirmed', '2026-01-01')",
  );
  insert.run('one', accountB.address, accountA.address.toLowerCase(), ownHash);
  insert.run('three', accountB.address, accountA.address.toLowerCase(), ownHash2);
  insert.run('two', accountA.address, accountB.address, otherHash);
  db.close();
  const library = await request('/credentials', 'GET', undefined, a);
  assert.equal(library.status, 200);
  assert.ok(
    library.body.items.some((item) => item.credential_hash === ownHash),
    'lowercase projected recipients remain visible',
  );
  const input = {
    handle: 'Alice',
    name: 'Alice',
    headline: 'Researcher',
    bio: 'Hello',
    links: ['https://example.com'],
    credentialHashes: [],
    published: false,
    avatarUrl: 'https://images.example.com/alice.png',
    projects: [
      {
        id: 'portfolio_1',
        name: 'Portfolio',
        description: 'Selected work',
        url: 'https://example.com/work',
      },
      { id: 'open-source-2', name: 'Open source', description: 'Contributions', url: '' },
    ],
    experience: [
      {
        id: 'role_1',
        role: 'Engineer',
        organization: 'Example Labs',
        period: '2024–now',
        description: 'Built things',
      },
    ],
    education: [
      {
        id: 'school-1',
        school: 'Example University',
        degree: 'B.Tech',
        period: '2020–2024',
        description: 'Computer science',
      },
    ],
  };
  assert.equal((await request('/profile', 'PUT', input)).status, 401);
  const creationInput = {
    ...input,
    projects: input.projects.map((project, index) =>
      index === 0 ? { ...project, privateNote: 'must be discarded' } : project,
    ),
  };
  const created = await request('/profile', 'PUT', creationInput, a);
  assert.equal(created.status, 200);
  assert.equal(created.body.profile.handle, 'alice');
  assert.equal(created.body.profile.avatarUrl, input.avatarUrl);
  assert.deepEqual(created.body.profile.projects, input.projects);
  assert.deepEqual(created.body.profile.experience, input.experience);
  assert.deepEqual(created.body.profile.education, input.education);
  assert.equal('unexpected' in created.body.profile.projects[0], false);
  assert.equal('privateNote' in created.body.profile.projects[0], false);
  assert.equal((await request('/profiles/alice')).status, 404);
  assert.deepEqual((await request(`/credentials/${ownHash}/recipient-profile`)).body, {
    profile: null,
  });
  assert.equal((await request('/profile', 'PUT', { ...input, handle: 'ALICE' }, b)).status, 409);
  assert.equal((await request('/profile', 'PUT', { ...input, handle: 'admin' }, b)).status, 400);
  assert.equal(
    (
      await request(
        '/profile',
        'PUT',
        {
          ...input,
          projects: [
            { ...input.projects[0], id: 'dup' },
            { ...input.projects[1], id: 'dup' },
          ],
        },
        a,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        '/profile',
        'PUT',
        { ...input, projects: [{ ...input.projects[0], name: '   ' }] },
        a,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        '/profile',
        'PUT',
        { ...input, avatarUrl: 'http://images.example.com/a.png' },
        a,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        '/profile',
        'PUT',
        { ...input, projects: [{ ...input.projects[0], url: 'javascript:alert(1)' }] },
        a,
      )
    ).status,
    400,
  );
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
    { ...input, credentialHashes: [ownHash, ownHash2], published: true },
    a,
  );
  assert.equal(published.body.profile.id, created.body.profile.id);
  const publicView = await request('/profiles/alice');
  assert.equal(publicView.status, 200);
  assert.equal(publicView.body.profile.name, 'Alice');
  assert.deepEqual(publicView.body.profile.credentialHashes, [ownHash, ownHash2]);
  assert.deepEqual(publicView.body.profile.credentialSummaries, [
    {
      credentialHash: ownHash,
      skillName: 'Course',
      skillLevel: '1',
      issueDate: '2026-01-01',
      organizationName: null,
    },
    {
      credentialHash: ownHash2,
      skillName: 'Course',
      skillLevel: '1',
      issueDate: '2026-01-01',
      organizationName: null,
    },
  ]);
  assert.deepEqual(publicView.body.profile.projects, input.projects);
  assert.deepEqual(publicView.body.profile.education, input.education);
  const reorderedProjects = [...input.projects].reverse();
  const reordered = await request(
    '/profile',
    'PUT',
    {
      ...input,
      projects: reorderedProjects,
      credentialHashes: [ownHash, ownHash2],
      published: true,
    },
    a,
  );
  assert.equal(reordered.status, 200);
  assert.deepEqual(
    reordered.body.profile.projects.map((item) => item.id),
    ['open-source-2', 'portfolio_1'],
  );
  assert.deepEqual(reordered.body.profile.experience, input.experience);
  assert.deepEqual(reordered.body.profile.education, input.education);
  assert.deepEqual((await request(`/credentials/${ownHash}/recipient-profile`)).body, {
    profile: { name: 'Alice', handle: 'alice' },
  });
  assert.deepEqual((await request(`/credentials/${otherHash}/recipient-profile`)).body, {
    profile: null,
  });
  assert.deepEqual(
    (await request(`/credentials/${`0x${'d'.repeat(64)}`}/recipient-profile`)).body,
    { profile: null },
  );
  const changed = new DatabaseSync(databasePath);
  changed
    .prepare('UPDATE issuances SET learner = ? WHERE credential_hash = ?')
    .run(accountB.address, ownHash);
  assert.deepEqual((await request(`/credentials/${ownHash}/recipient-profile`)).body, {
    profile: null,
  });
  changed
    .prepare('UPDATE issuances SET learner = ? WHERE credential_hash = ?')
    .run(accountA.address.toLowerCase(), ownHash);
  changed.close();
  assert.equal('handleChangedAt' in publicView.body.profile, false);
  assert.equal('token' in publicView.body.profile, false);
  const legacyUpdate = { ...input };
  delete legacyUpdate.avatarUrl;
  delete legacyUpdate.projects;
  delete legacyUpdate.experience;
  delete legacyUpdate.education;
  const preserved = await request('/profile', 'PUT', legacyUpdate, a);
  assert.deepEqual(
    preserved.body.profile.projects.map((item) => item.id),
    ['open-source-2', 'portfolio_1'],
  );
  assert.equal(preserved.body.profile.avatarUrl, input.avatarUrl);
  assert.equal((await request('/profiles/alice')).status, 404);
  assert.deepEqual((await request(`/credentials/${ownHash}/recipient-profile`)).body, {
    profile: null,
  });
  console.log('Profile privacy, authorization, handle and selection checks passed');
} finally {
  child.kill();
  await once(child, 'exit');
  rmSync(tempDir, { recursive: true, force: true });
}
