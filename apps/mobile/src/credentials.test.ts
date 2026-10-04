import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReference, readSavedCredentials, verifyCredential } from './credentials';
const hash = `0x${'a'.repeat(64)}`;

test('accepts hashes and public verification links without following arbitrary QR URLs', () => {
  assert.equal(parseReference(` ${hash} `), hash);
  assert.equal(parseReference(`https://credora.example/verify/${hash}`), hash);
  for (const value of [
    'javascript:alert(1)',
    'https://example.com/phishing',
    '0x12',
    `https://example.com/verify/${hash}/extra`,
  ])
    assert.equal(parseReference(value), undefined);
});
test('saved library retains references, never accepts cached verification state as proof', () => {
  assert.deepEqual(readSavedCredentials(null), []);
  const rows = readSavedCredentials(
    JSON.stringify([
      { hash, name: 'Public credential', savedAt: '2026-10-04', state: 'valid' },
      { hash: 'bad', name: 'Fake', savedAt: 'today' },
      { hash: 12, name: 'Malformed', savedAt: 'today' },
    ]),
  );
  assert.equal(rows.length, 1);
  assert.equal('state' in rows[0], false);
  assert.throws(() => readSavedCredentials('{}'));
});
test('keeps proof failures distinct from service failures and rejects incomplete valid responses', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const state of [
      'not-found',
      'ledger-unavailable',
      'metadata-unavailable',
      'metadata-invalid',
      'malformed',
    ]) {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ state, message: state }), {
          status: state.includes('unavailable') ? 503 : 200,
        });
      assert.equal((await verifyCredential('https://api.example', hash)).state, state);
    }
    for (const body of [
      { state: 'valid' },
      { state: 'unknown' },
      { state: 'valid', metadata: { schemaVersion: 1 } },
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify(body));
      assert.equal(
        (await verifyCredential('https://api.example', hash)).state,
        'service-unavailable',
      );
    }
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'LEDGER_UNAVAILABLE' }), { status: 503 });
    assert.equal((await verifyCredential('https://api.example', hash)).state, 'ledger-unavailable');
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    assert.equal(
      (await verifyCredential('https://api.example', hash)).state,
      'service-unavailable',
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          state: 'valid',
          metadata: {
            schemaVersion: 1,
            skillName: 'Systems thinking',
            skillLevel: 'Advanced',
            issueDate: '2026-10-04T00:00:00Z',
            issuerAddress: '0x1111111111111111111111111111111111111111',
            learnerAddress: '0x2222222222222222222222222222222222222222',
          },
        }),
      );
    const result = await verifyCredential('https://api.example', hash);
    assert.equal(result.state, 'valid');
    assert.equal(result.metadata?.skillName, 'Systems thinking');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
