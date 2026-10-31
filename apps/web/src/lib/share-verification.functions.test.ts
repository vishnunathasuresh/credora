import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VerificationResult } from './verification.server';
import {
  fetchShareResolution,
  loadShareVerificationData,
  readBoundedShareJson,
} from './share-verification.server';

const futureExpiry = new Date(Date.now() + 60_000).toISOString();
const first = `0x${'11'.repeat(32)}`;
const second = `0x${'22'.repeat(32)}`;

function dependencies(
  resolutions: Array<
    | { ok: true; expiresAt: string; credentials: { credentialHash: string }[] }
    | { ok: false; error: string; errorCode: string }
  >,
  verify: (hash: string) => Promise<VerificationResult>,
) {
  let resolveCount = 0;
  const resolvedTokens: string[] = [];
  return {
    deps: {
      resolve: async (token: string) => {
        resolvedTokens.push(token);
        return resolutions[resolveCount++];
      },
      verify,
      issuerProfile: async () => null,
    },
    resolvedTokens,
  };
}

test('share resolution is checked again after verifying each selected credential', async () => {
  const { deps, resolvedTokens } = dependencies(
    [
      { ok: true, expiresAt: futureExpiry, credentials: [{ credentialHash: first }] },
      { ok: false, error: 'revoked', errorCode: 'SHARE_EXPIRED' },
    ],
    async () => ({ state: 'valid', source: 'direct-rpc' }),
  );
  const data = await loadShareVerificationData('a'.repeat(43), deps);
  assert.equal(data.errorCode, 'SHARE_EXPIRED');
  assert.deepEqual(data.credentials, []);
  assert.deepEqual(resolvedTokens, ['a'.repeat(43), 'a'.repeat(43)]);
});

test('share expiry during verification prevents credential results from being returned', async () => {
  const { deps } = dependencies(
    [
      { ok: true, expiresAt: futureExpiry, credentials: [{ credentialHash: first }] },
      {
        ok: true,
        expiresAt: new Date(Date.now() - 1).toISOString(),
        credentials: [{ credentialHash: first }],
      },
    ],
    async () => ({ state: 'valid', source: 'direct-rpc' }),
  );
  const data = await loadShareVerificationData('b'.repeat(43), deps);
  assert.equal(data.errorCode, 'SHARE_EXPIRED');
  assert.deepEqual(data.credentials, []);
});

test('each share item is verified independently and one failure does not hide other results', async () => {
  const checked: string[] = [];
  const { deps } = dependencies(
    [
      {
        ok: true,
        expiresAt: futureExpiry,
        credentials: [{ credentialHash: first }, { credentialHash: second }],
      },
      {
        ok: true,
        expiresAt: futureExpiry,
        credentials: [{ credentialHash: first }, { credentialHash: second }],
      },
    ],
    async (hash) => {
      checked.push(hash);
      if (hash === first) throw new Error('rpc unavailable');
      return { state: 'not-found', source: 'direct-rpc' };
    },
  );
  const data = await loadShareVerificationData('c'.repeat(43), deps);
  assert.deepEqual(checked.sort(), [first, second].sort());
  assert.equal(data.credentials[0]?.result.state, 'ledger-unavailable');
  assert.equal(data.credentials[1]?.result.state, 'not-found');
  assert.equal(data.error, undefined);
});

test('share resolution rejects an oversized declared content length', async () => {
  const response = new Response('{}', {
    headers: { 'content-length': String(32 * 1024 + 1) },
  });
  await assert.rejects(readBoundedShareJson(response, new AbortController().signal), /exceeds/);
});

test('share resolution enforces the body limit when content length is missing or false', async (t) => {
  for (const contentLength of [undefined, '1']) {
    await t.test(contentLength ?? 'missing content-length', async () => {
      const headers = contentLength ? { 'content-length': contentLength } : undefined;
      const response = new Response(' '.repeat(32 * 1024 + 1), { headers });
      await assert.rejects(readBoundedShareJson(response, new AbortController().signal), /exceeds/);
    });
  }
});

test('share resolution timeout cancels a stalled response body', async () => {
  let canceled = false;
  const stalled = new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {
        canceled = true;
      },
    }),
  );
  const result = await fetchShareResolution('d'.repeat(43), 15, async () => stalled);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /unavailable/i);
  assert.equal(canceled, true);
});

test('share resolution sends the bearer only in a POST body to a fixed API path', async () => {
  const token = 'e'.repeat(43);
  let observedUrl = '';
  let observedMethod = '';
  let observedBody = '';
  const result = await fetchShareResolution(token, 1000, async (input, init) => {
    observedUrl = String(input);
    observedMethod = init?.method ?? '';
    observedBody = String(init?.body ?? '');
    return new Response(
      JSON.stringify({ expiresAt: futureExpiry, credentials: [{ credentialHash: first }] }),
      { headers: { 'content-type': 'application/json' } },
    );
  });
  assert.equal(result.ok, true);
  assert.match(observedUrl, /\/wallet\/share-resolution$/);
  assert.equal(observedUrl.includes(token), false);
  assert.equal(observedMethod, 'POST');
  assert.deepEqual(JSON.parse(observedBody), { token });
});
