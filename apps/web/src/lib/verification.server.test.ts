import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VerificationResult } from './verification.server';
import { fetchVerification } from './verification.server';

const credentialHash = `0x${'ab'.repeat(32)}`;

test('verification returns direct multi-registry result without requesting unused API proof data', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('fetch should not be called for ordinary proof verification');
  }) as typeof fetch;
  const expected: VerificationResult = {
    state: 'valid',
    source: 'direct-rpc',
    protocolVersion: 3,
  };
  try {
    const result = await fetchVerification(credentialHash, async (reference) => {
      assert.equal(reference, credentialHash);
      return expected;
    });
    assert.equal(result, expected);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('direct not-found and infrastructure states are returned without API substitution', async (t) => {
  const states: VerificationResult[] = [
    { state: 'not-found', source: 'direct-rpc' },
    { state: 'metadata-unavailable', source: 'direct-rpc' },
    { state: 'ledger-unavailable', source: 'direct-rpc' },
    { state: 'metadata-invalid', source: 'direct-rpc' },
  ];
  for (const expected of states) {
    await t.test(expected.state, async () => {
      const result = await fetchVerification(credentialHash, async () => expected);
      assert.equal(result, expected);
    });
  }
});

test('malformed references remain explicitly malformed without HTTP or registry lookup', async () => {
  const originalFetch = globalThis.fetch;
  let directCalls = 0;
  globalThis.fetch = (async () => {
    throw new Error('fetch should not be called for malformed references');
  }) as typeof fetch;
  try {
    const result = await fetchVerification('not-a-hash', async () => {
      directCalls += 1;
      return { state: 'valid', source: 'direct-rpc' };
    });
    assert.equal(result.state, 'malformed');
    assert.equal(directCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unexpected direct verifier errors remain ledger unavailable', async () => {
  const result = await fetchVerification(credentialHash, async () => {
    throw new Error('unexpected verifier error');
  });
  assert.equal(result.state, 'ledger-unavailable');
  assert.equal(result.source, 'direct-rpc');
});
