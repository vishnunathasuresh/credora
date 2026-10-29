import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { privateKeyToAccount } from 'viem/accounts';

// ---------------------------------------------------------------------------
// 1. Local Fake Supabase Auth HTTP Server
// ---------------------------------------------------------------------------
const SUPABASE_PUBLISHABLE_KEY = 'credora-test-anon-publishable-key-001';

const FAKE_USERS = {
  'token-user-a': { id: 'usr-sub-alice-0001', email: 'alice@example.com' },
  'token-user-b': { id: 'usr-sub-bob-0002', email: 'bob@example.com' },
  'token-user-c': { id: 'usr-sub-carol-0003', email: 'carol@example.com' },
};

function makeJwtToken(userId, email, sessionId) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email,
      session_id: sessionId,
    }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

const JWT_USER_A_SESS1 = makeJwtToken('usr-sub-alice-0001', 'alice@example.com', 'session-alice-1');
const JWT_USER_A_SESS2 = makeJwtToken('usr-sub-alice-0001', 'alice@example.com', 'session-alice-2');
FAKE_USERS[JWT_USER_A_SESS1] = { id: 'usr-sub-alice-0001', email: 'alice@example.com' };
FAKE_USERS[JWT_USER_A_SESS2] = { id: 'usr-sub-alice-0001', email: 'alice@example.com' };

let authOutage = false;

const fakeAuthServer = http.createServer((req, res) => {
  if (authOutage) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Supabase Auth service unavailable' }));
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  if (parsedUrl.pathname !== '/auth/v1/user') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
    return;
  }

  const apikey = req.headers['apikey'];
  if (apikey !== SUPABASE_PUBLISHABLE_KEY) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Invalid API key', status: 401 }));
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Missing bearer authorization', status: 401 }));
    return;
  }

  const token = authHeader.slice(7);
  if (token === 'token-server-error') {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Internal Server Error' }));
    return;
  }

  const user = FAKE_USERS[token];
  if (user) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(user));
  } else {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Invalid or expired JWT', status: 401 }));
  }
});

fakeAuthServer.listen(0, '127.0.0.1');
await once(fakeAuthServer, 'listening');
const authPort = fakeAuthServer.address().port;
const supabaseUrl = `http://127.0.0.1:${authPort}`;

// ---------------------------------------------------------------------------
// 2. Port allocation and API Child Process Setup
// ---------------------------------------------------------------------------
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const { port } = probe.address();
probe.close();
await once(probe, 'close');

const tempDir = mkdtempSync(join(tmpdir(), 'credora-accounts-'));
const databasePath = join(tempDir, 'api.sqlite');

const child = spawn(process.execPath, ['../../node_modules/tsx/dist/cli.mjs', 'src/index.ts'], {
  cwd: 'apps/api',
  detached: true,
  env: {
    ...process.env,
    API_PORT: String(port),
    API_DATABASE_PATH: databasePath,
    CREDENTIAL_REGISTRY_ADDRESS: '',
    API_RATE_LIMIT_MAX: '1000',
    API_APP_ORIGIN: 'http://localhost:3000',
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
child.stderr.on('data', (chunk) => (logs += chunk));
child.stdout.on('data', (chunk) => (logs += chunk));

const base = `http://127.0.0.1:${port}`;

async function request(path, method = 'GET', body, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      Origin: 'http://localhost:3000',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let resBody;
  try {
    resBody = await response.json();
  } catch {
    resBody = null;
  }
  return { status: response.status, body: resBody };
}

async function legacySession(account) {
  const challenge = await request('/auth/challenge', 'POST', { address: account.address });
  const signature = await account.signMessage({ message: challenge.body.message });
  return (await request('/auth/verify', 'POST', { address: account.address, signature })).body
    .token;
}

try {
  // Wait for API server to become healthy
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(base + '/health');
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Server failed to start. Logs: ${logs}`);

  // Test accounts & keys (synthetic only, no real chain/production keys)
  const wallet1 = privateKeyToAccount(`0x${'1'.repeat(64)}`);
  const wallet2 = privateKeyToAccount(`0x${'2'.repeat(64)}`);
  const wallet3 = privateKeyToAccount(`0x${'3'.repeat(64)}`);
  const walletAttacker = privateKeyToAccount(`0x${'4'.repeat(64)}`);

  console.log('API server started and healthy. Running account integration tests...');

  // -------------------------------------------------------------------------
  // 3. Auth Rejection vs Service Unavailable Distinction
  // -------------------------------------------------------------------------
  // Missing token -> 401 UNAUTHORIZED
  const noToken = await request('/account', 'GET');
  assert.equal(noToken.status, 401);
  assert.equal(noToken.body.error, 'UNAUTHORIZED');

  // Invalid fake token -> 401 UNAUTHORIZED
  const badToken = await request('/account', 'GET', undefined, 'token-completely-invalid');
  assert.equal(badToken.status, 401);
  assert.equal(badToken.body.error, 'UNAUTHORIZED');

  // Fake auth server 500 error -> 503 AUTH_UNAVAILABLE
  const serverErrorAuth = await request('/account', 'GET', undefined, 'token-server-error');
  assert.equal(serverErrorAuth.status, 503);
  assert.equal(serverErrorAuth.body.error, 'AUTH_UNAVAILABLE');

  // Fake auth server offline/outage -> 503 AUTH_UNAVAILABLE
  authOutage = true;
  const outageRes = await request('/account', 'GET', undefined, JWT_USER_A_SESS1);
  assert.equal(outageRes.status, 503);
  assert.equal(outageRes.body.error, 'AUTH_UNAVAILABLE');
  authOutage = false;

  // -------------------------------------------------------------------------
  // 4. Walletless Private Profile Lifecycle
  // -------------------------------------------------------------------------
  // Initial GET /account for new User A
  const initialA = await request('/account', 'GET', undefined, JWT_USER_A_SESS1);
  assert.equal(initialA.status, 200);
  assert.ok(typeof initialA.body.account?.id === 'string' && initialA.body.account.id.length > 0);
  assert.equal(initialA.body.profile, null);
  assert.deepEqual(initialA.body.wallets, []);
  const userAAccountId = initialA.body.account.id;

  // Initial GET /account/profile for new User A is null
  const initialProfileA = await request('/account/profile', 'GET', undefined, JWT_USER_A_SESS1);
  assert.equal(initialProfileA.status, 200);
  assert.equal(initialProfileA.body.profile, null);

  // User A creates private profile with no linked wallet (walletless)
  const profileInputA = {
    handle: 'Alice',
    name: 'Alice Smith',
    headline: 'Security Researcher',
    bio: 'Decentralized identity auditor',
    links: ['https://alice.example.com'],
    credentialHashes: [],
    published: false,
    avatarUrl: 'https://images.example.com/alice.png',
    projects: [
      {
        id: 'proj-1',
        name: 'Credora Integration',
        description: 'Account tests',
        url: 'https://example.com/code',
      },
    ],
    experience: [
      {
        id: 'exp-1',
        role: 'Auditor',
        organization: 'Independent',
        period: '2025-2026',
        description: 'Identity security',
      },
    ],
    education: [
      {
        id: 'edu-1',
        school: 'State University',
        degree: 'B.S.',
        period: '2020-2024',
        description: 'CS',
      },
    ],
  };

  const createdA = await request('/account/profile', 'PUT', profileInputA, JWT_USER_A_SESS1);
  assert.equal(createdA.status, 200);
  assert.equal(createdA.body.profile.handle, 'alice'); // normalized lowercase
  assert.equal(createdA.body.profile.name, 'Alice Smith');
  assert.equal(createdA.body.profile.published, false);
  assert.deepEqual(createdA.body.profile.projects, profileInputA.projects);

  // Check GET /account now returns created profile and still empty wallets
  const accountAfterCreation = await request('/account', 'GET', undefined, JWT_USER_A_SESS1);
  assert.equal(accountAfterCreation.status, 200);
  assert.equal(accountAfterCreation.body.profile?.handle, 'alice');
  assert.deepEqual(accountAfterCreation.body.wallets, []);

  // Check public profile lookup is 404 while unpublished
  const publicViewUnpublished = await request('/profiles/alice');
  assert.equal(publicViewUnpublished.status, 404);

  // -------------------------------------------------------------------------
  // 5. Cross-Account Isolation and Handles Availability
  // -------------------------------------------------------------------------
  // User B signs in: distinct account ID, profile is null
  const initialB = await request('/account', 'GET', undefined, 'token-user-b');
  assert.equal(initialB.status, 200);
  assert.notEqual(initialB.body.account.id, userAAccountId);
  assert.equal(initialB.body.profile, null);

  // Handles lookup: 'alice' is taken, 'bob' is available
  const handleCheckTaken = await request(
    '/account/handles/alice',
    'GET',
    undefined,
    'token-user-b',
  );
  assert.equal(handleCheckTaken.status, 200);
  assert.equal(handleCheckTaken.body.handle, 'alice');
  assert.equal(handleCheckTaken.body.available, false);

  const handleCheckCaseTaken = await request(
    '/account/handles/ALICE',
    'GET',
    undefined,
    'token-user-b',
  );
  assert.equal(handleCheckCaseTaken.status, 200);
  assert.equal(handleCheckCaseTaken.body.available, false);

  const handleCheckAvailable = await request(
    '/account/handles/bob',
    'GET',
    undefined,
    'token-user-b',
  );
  assert.equal(handleCheckAvailable.status, 200);
  assert.equal(handleCheckAvailable.body.handle, 'bob');
  assert.equal(handleCheckAvailable.body.available, true);

  // Reserved handle returns 400 INVALID_HANDLE
  const handleCheckReserved = await request(
    '/account/handles/admin',
    'GET',
    undefined,
    'token-user-b',
  );
  assert.equal(handleCheckReserved.status, 400);
  assert.equal(handleCheckReserved.body.error, 'INVALID_HANDLE');

  // User B tries to claim 'alice' handle -> 409 HANDLE_TAKEN
  const conflictProfileB = await request(
    '/account/profile',
    'PUT',
    { ...profileInputA, handle: 'alice', name: 'Imposter' },
    'token-user-b',
  );
  assert.equal(conflictProfileB.status, 409);
  assert.equal(conflictProfileB.body.error, 'HANDLE_TAKEN');

  // User B creates their own profile with 'bob'
  const createdB = await request(
    '/account/profile',
    'PUT',
    { ...profileInputA, handle: 'bob', name: 'Bob' },
    'token-user-b',
  );
  assert.equal(createdB.status, 200);
  assert.equal(createdB.body.profile.handle, 'bob');

  // Verify User A's profile was not modified by User B's actions
  const verifyProfileA = await request('/account/profile', 'GET', undefined, JWT_USER_A_SESS1);
  assert.equal(verifyProfileA.body.profile.name, 'Alice Smith');

  // -------------------------------------------------------------------------
  // 6. Wallet Linking: Fresh Signed Challenge, Signer/Replay/Binding Checks
  // -------------------------------------------------------------------------
  // Invalid action returns 400
  const badAction = await request(
    '/account/wallets/challenge',
    'POST',
    { address: wallet1.address, action: 'invalid' },
    JWT_USER_A_SESS1,
  );
  assert.equal(badAction.status, 400);
  assert.equal(badAction.body.error, 'INVALID_WALLET_ACTION');

  // User A requests link challenge for wallet1
  const linkChallengeA = await request(
    '/account/wallets/challenge',
    'POST',
    { address: wallet1.address, action: 'link' },
    JWT_USER_A_SESS1,
  );
  assert.equal(linkChallengeA.status, 200);
  assert.ok(linkChallengeA.body.id);
  assert.ok(linkChallengeA.body.message.includes('Credora wallet link'));
  assert.ok(linkChallengeA.body.message.includes(`Address: ${wallet1.address}`));
  assert.ok(linkChallengeA.body.message.includes(`Account ID: ${userAAccountId}`));
  assert.equal(linkChallengeA.body.migrationRequired, false);

  const challengeId = linkChallengeA.body.id;
  const challengeMessage = linkChallengeA.body.message;

  // Sign message using correct wallet1
  const validSignature = await wallet1.signMessage({ message: challengeMessage });

  // Sign message using WRONG wallet (walletAttacker)
  const wrongSignature = await walletAttacker.signMessage({ message: challengeMessage });

  // Wrong signer fails with 401 INVALID_SIGNATURE
  const wrongSignerRes = await request(
    '/account/wallets/verify',
    'POST',
    { challengeId, signature: wrongSignature },
    JWT_USER_A_SESS1,
  );
  assert.equal(wrongSignerRes.status, 401);
  assert.equal(wrongSignerRes.body.error, 'INVALID_SIGNATURE');

  // Cross-account challenge theft attempt: User B tries to verify User A's challenge
  const crossAccountVerify = await request(
    '/account/wallets/verify',
    'POST',
    { challengeId, signature: validSignature },
    'token-user-b',
  );
  assert.equal(crossAccountVerify.status, 401);
  assert.equal(crossAccountVerify.body.error, 'CHALLENGE_EXPIRED');

  // Session binding check: User A using different session ID
  const crossSessionVerify = await request(
    '/account/wallets/verify',
    'POST',
    { challengeId, signature: validSignature },
    JWT_USER_A_SESS2,
  );
  assert.equal(crossSessionVerify.status, 401);
  assert.equal(crossSessionVerify.body.error, 'CHALLENGE_EXPIRED');

  // Valid verification on User A
  const validVerify = await request(
    '/account/wallets/verify',
    'POST',
    { challengeId, signature: validSignature },
    JWT_USER_A_SESS1,
  );
  assert.equal(validVerify.status, 200);
  assert.equal(validVerify.body.wallets.length, 1);
  assert.equal(validVerify.body.wallets[0].address.toLowerCase(), wallet1.address.toLowerCase());
  assert.ok(validVerify.body.wallets[0].linkedAt);

  // Replay attack: submitting same challenge again fails with 401
  const replayVerify = await request(
    '/account/wallets/verify',
    'POST',
    { challengeId, signature: validSignature },
    JWT_USER_A_SESS1,
  );
  assert.equal(replayVerify.status, 401);
  assert.ok(['CHALLENGE_EXPIRED', 'CHALLENGE_REPLAY'].includes(replayVerify.body.error));

  // Link uniqueness: User B attempts to link wallet1 (already linked to A) -> 409 WALLET_CONFLICT
  const duplicateLinkChallenge = await request(
    '/account/wallets/challenge',
    'POST',
    { address: wallet1.address, action: 'link' },
    'token-user-b',
  );
  assert.equal(duplicateLinkChallenge.status, 409);
  assert.equal(duplicateLinkChallenge.body.error, 'WALLET_CONFLICT');

  // -------------------------------------------------------------------------
  // 7. Credential Ownership Selection, Verification, and Projections
  // -------------------------------------------------------------------------
  // Insert confirmed credential projections into SQLite database:
  // - ownCred1: learner = wallet1.address (linked to User A)
  // - ownCred2: learner = lowercase wallet1.address (linked to User A)
  // - otherCred: learner = wallet2.address (NOT linked to User A)
  const db = new DatabaseSync(databasePath);
  const ownCred1 = `0x${'a'.repeat(64)}`;
  const ownCred2 = `0x${'b'.repeat(64)}`;
  const otherCred = `0x${'c'.repeat(64)}`;

  const insertIssuance = db.prepare(
    "INSERT INTO issuances (id, issuer, learner, skill_name, skill_level, issue_date, credential_hash, state, created_at) VALUES (?, ?, ?, 'Cryptography', 'Advanced', '2026-02-01', ?, 'confirmed', '2026-02-01')",
  );
  insertIssuance.run('iss-1', wallet2.address, wallet1.address, ownCred1);
  insertIssuance.run('iss-2', wallet2.address, wallet1.address.toLowerCase(), ownCred2);
  insertIssuance.run('iss-3', wallet1.address, wallet2.address, otherCred);
  db.close();

  // GET /account/credentials for User A: returns ownCred1 and ownCred2, excludes otherCred
  const credsA = await request('/account/credentials', 'GET', undefined, JWT_USER_A_SESS1);
  assert.equal(credsA.status, 200);
  assert.ok(Array.isArray(credsA.body.items));
  const hashesA = credsA.body.items.map((i) => i.credential_hash.toLowerCase());
  assert.ok(hashesA.includes(ownCred1.toLowerCase()));
  assert.ok(hashesA.includes(ownCred2.toLowerCase()));
  assert.equal(hashesA.includes(otherCred.toLowerCase()), false);

  // Attempting to feature otherCred (not owned by any linked wallet) fails
  const invalidSelection = await request(
    '/account/profile',
    'PUT',
    { ...profileInputA, credentialHashes: [ownCred1, otherCred], published: true },
    JWT_USER_A_SESS1,
  );
  assert.equal(invalidSelection.status, 400);
  assert.equal(invalidSelection.body.error, 'INVALID_PROFILE_SELECTION');

  // Featuring only owned credentials succeeds and publishes profile
  const validPublish = await request(
    '/account/profile',
    'PUT',
    { ...profileInputA, credentialHashes: [ownCred1, ownCred2], published: true },
    JWT_USER_A_SESS1,
  );
  assert.equal(validPublish.status, 200);
  assert.equal(validPublish.body.profile.published, true);
  assert.deepEqual(validPublish.body.profile.credentialHashes, [ownCred1, ownCred2]);

  // Public view /profiles/alice now resolves with summaries
  const publicViewAlice = await request('/profiles/alice');
  assert.equal(publicViewAlice.status, 200);
  assert.equal(publicViewAlice.body.profile.name, 'Alice Smith');
  assert.equal(publicViewAlice.body.profile.credentialSummaries.length, 2);
  assert.equal(
    publicViewAlice.body.profile.credentialSummaries[0].credentialHash.toLowerCase(),
    ownCred1.toLowerCase(),
  );

  // -------------------------------------------------------------------------
  // 8. Unlink Suppresses Profile Selections
  // -------------------------------------------------------------------------
  // Request unlink challenge for wallet1
  const unlinkChallenge = await request(
    '/account/wallets/challenge',
    'POST',
    { address: wallet1.address, action: 'unlink' },
    JWT_USER_A_SESS1,
  );
  assert.equal(unlinkChallenge.status, 200);
  assert.ok(unlinkChallenge.body.message.includes('Credora wallet unlink'));

  const unlinkSig = await wallet1.signMessage({ message: unlinkChallenge.body.message });
  const unlinkVerify = await request(
    '/account/wallets/verify',
    'POST',
    { challengeId: unlinkChallenge.body.id, signature: unlinkSig },
    JWT_USER_A_SESS1,
  );
  assert.equal(unlinkVerify.status, 200);
  assert.deepEqual(unlinkVerify.body.wallets, []);

  // Verify /account shows zero wallets
  const accountAfterUnlink = await request('/account', 'GET', undefined, JWT_USER_A_SESS1);
  assert.deepEqual(accountAfterUnlink.body.wallets, []);

  // Verify /account/credentials is now empty
  const credsAfterUnlink = await request(
    '/account/credentials',
    'GET',
    undefined,
    JWT_USER_A_SESS1,
  );
  assert.deepEqual(credsAfterUnlink.body.items, []);

  // Verify unlinking suppressed public profile selections and summaries
  const publicViewAfterUnlink = await request('/profiles/alice');
  assert.equal(publicViewAfterUnlink.status, 200);
  assert.deepEqual(publicViewAfterUnlink.body.profile.credentialSummaries, []);

  // Attempting to unlink again -> 404 WALLET_NOT_LINKED
  const unlinkAgainChallenge = await request(
    '/account/wallets/challenge',
    'POST',
    { address: wallet1.address, action: 'unlink' },
    JWT_USER_A_SESS1,
  );
  assert.equal(unlinkAgainChallenge.status, 404);
  assert.equal(unlinkAgainChallenge.body.error, 'WALLET_NOT_LINKED');

  // -------------------------------------------------------------------------
  // 9. Legacy Profile Import Consent and Conflict Handling
  // -------------------------------------------------------------------------
  // Create an unclaimed legacy profile associated directly with wallet3
  const legacySessionW3 = await legacySession(wallet3);
  const legacyProfileInput = {
    handle: 'carol',
    name: 'Carol Legacy',
    headline: 'Legacy Contributor',
    bio: 'Profile created before Google auth',
    links: [],
    credentialHashes: [],
    published: true,
  };
  const createdLegacy = await request('/profile', 'PUT', legacyProfileInput, legacySessionW3);
  assert.equal(createdLegacy.status, 200);
  assert.equal(createdLegacy.body.profile.handle, 'carol');

  // Scenario 9A: Account with NO profile (User C) links wallet3
  const userCInitial = await request('/account', 'GET', undefined, 'token-user-c');
  assert.equal(userCInitial.body.profile, null);

  const linkLegacyChallenge = await request(
    '/account/wallets/challenge',
    'POST',
    { address: wallet3.address, action: 'link' },
    'token-user-c',
  );
  assert.equal(linkLegacyChallenge.status, 200);
  assert.equal(linkLegacyChallenge.body.migrationRequired, true);
  assert.equal(linkLegacyChallenge.body.legacyProfile?.handle, 'carol');

  const legacySig = await wallet3.signMessage({ message: linkLegacyChallenge.body.message });

  // Missing explicit consent (importLegacyProfile !== true) -> 409 MIGRATION_REQUIRED
  const noConsentVerify = await request(
    '/account/wallets/verify',
    'POST',
    { challengeId: linkLegacyChallenge.body.id, signature: legacySig },
    'token-user-c',
  );
  assert.equal(noConsentVerify.status, 409);
  assert.equal(noConsentVerify.body.error, 'MIGRATION_REQUIRED');

  // Fresh challenge with explicit consent -> transfers profile ownership to User C's account
  const linkLegacyFresh = await request(
    '/account/wallets/challenge',
    'POST',
    { address: wallet3.address, action: 'link' },
    'token-user-c',
  );
  const freshLegacySig = await wallet3.signMessage({ message: linkLegacyFresh.body.message });

  const consentVerify = await request(
    '/account/wallets/verify',
    'POST',
    {
      challengeId: linkLegacyFresh.body.id,
      signature: freshLegacySig,
      importLegacyProfile: true,
    },
    'token-user-c',
  );
  assert.equal(consentVerify.status, 200);
  assert.equal(consentVerify.body.wallets.length, 1);
  assert.equal(consentVerify.body.profile?.handle, 'carol');

  // Check User C account now owns carol's profile
  const userCAccount = await request('/account', 'GET', undefined, 'token-user-c');
  assert.equal(userCAccount.body.profile?.handle, 'carol');
  assert.equal(userCAccount.body.profile?.name, 'Carol Legacy');

  // Scenario 9B: Two-profile conflict
  // User B already has a profile ('bob'). Let's create another legacy profile with walletAttacker.
  const legacyAttackerSession = await legacySession(walletAttacker);
  const legacyDaveInput = {
    handle: 'dave',
    name: 'Dave Legacy',
    headline: 'Pre-auth profile',
    bio: 'Dave bio',
    links: [],
    credentialHashes: [],
    published: true,
  };
  const createdDave = await request('/profile', 'PUT', legacyDaveInput, legacyAttackerSession);
  assert.equal(createdDave.status, 200);
  assert.equal(createdDave.body.profile.handle, 'dave');

  // User B (who has profile 'bob') attempts to link walletAttacker (which has legacy profile 'dave')
  const conflictChallenge = await request(
    '/account/wallets/challenge',
    'POST',
    { address: walletAttacker.address, action: 'link' },
    'token-user-b',
  );
  assert.equal(conflictChallenge.status, 200);
  assert.equal(conflictChallenge.body.migrationRequired, true);

  const conflictSig = await walletAttacker.signMessage({ message: conflictChallenge.body.message });
  const conflictVerify = await request(
    '/account/wallets/verify',
    'POST',
    {
      challengeId: conflictChallenge.body.id,
      signature: conflictSig,
      importLegacyProfile: true,
    },
    'token-user-b',
  );
  assert.equal(conflictVerify.status, 409);
  assert.equal(conflictVerify.body.error, 'PROFILE_CONFLICT');

  // Verify neither profile was deleted or overwritten
  const verifyBProfile = await request('/account/profile', 'GET', undefined, 'token-user-b');
  assert.equal(verifyBProfile.body.profile.handle, 'bob');

  const verifyDavePublic = await request('/profiles/dave');
  assert.equal(verifyDavePublic.status, 200);
  assert.equal(verifyDavePublic.body.profile.name, 'Dave Legacy');

  console.log('All Credora account-first integration and security tests passed successfully!');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    process.kill(-child.pid, 'SIGKILL');
    await exited;
  }
  fakeAuthServer.closeAllConnections();
  await new Promise((resolve) => fakeAuthServer.close(resolve));
  rmSync(tempDir, { recursive: true, force: true });
}
