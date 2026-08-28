import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FileStorage, IpfsStorage } from './index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('file storage', () => {
  it('keeps metadata available after the adapter is recreated', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'credora-storage-'));
    temporaryDirectories.push(directory);
    const metadata = {
      schemaVersion: 1 as const,
      skillName: 'Distributed Systems',
      skillLevel: 'Advanced',
      issueDate: '2026-08-11T00:00:00.000Z',
      issuerAddress: '0x1111111111111111111111111111111111111111' as const,
      learnerAddress: '0x2222222222222222222222222222222222222222' as const,
    };

    const stored = await new FileStorage(directory).put(metadata);
    const restored = await new FileStorage(directory).get(stored.uri);

    assert.deepEqual(restored, metadata);
  });
});

describe('IPFS storage', () => {
  it('uploads JSON as a Kubo-compatible multipart file and reads it back', async () => {
    const metadata = {
      schemaVersion: 1 as const,
      skillName: 'Distributed Systems',
      skillLevel: 'Advanced',
      issueDate: '2026-08-11T00:00:00.000Z',
      issuerAddress: '0x1111111111111111111111111111111111111111' as const,
      learnerAddress: '0x2222222222222222222222222222222222222222' as const,
    };
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      if (calls.length === 1)
        return new Response(
          JSON.stringify({ Name: 'credential.json', Hash: 'bafytestcredential' }) + '\n',
          { status: 200 },
        );
      return new Response(JSON.stringify(metadata), { status: 200 });
    };
    const storage = new IpfsStorage({
      uploadUrl: 'https://rpc.filebase.io/api/v0/add?cid-version=1',
      gatewayBaseUrl: 'https://gateway.example/ipfs',
      uploadAuthToken: 'test-token',
      gatewayAuthToken: 'gateway-token',
      fetchImpl,
    });

    const stored = await storage.put(metadata);
    assert.deepEqual(stored, {
      cid: 'bafytestcredential',
      uri: 'ipfs://bafytestcredential',
    });
    assert.ok(calls[0]?.init?.body instanceof FormData);
    assert.equal(
      calls[0]?.init?.headers && new Headers(calls[0].init.headers).get('authorization'),
      'Bearer test-token',
    );
    const uploaded = calls[0]?.init?.body as FormData;
    const uploadedFile = uploaded.get('file');
    if (!(uploadedFile instanceof Blob)) throw new Error('Expected a multipart file upload');
    assert.equal(uploadedFile.type, 'application/json');
    assert.equal(await uploadedFile.text(), JSON.stringify(metadata));

    const restored = await storage.get(stored.uri);
    assert.deepEqual(restored, metadata);
    assert.equal(calls[1]?.url, 'https://gateway.example/ipfs/bafytestcredential');
    assert.equal(
      calls[1]?.init?.headers && new Headers(calls[1].init.headers).get('authorization'),
      'Bearer gateway-token',
    );
  });

  it('aborts a stalled IPFS request within the configured timeout', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    const storage = new IpfsStorage({
      uploadUrl: 'https://rpc.filebase.io/api/v0/add',
      gatewayBaseUrl: 'https://gateway.example/ipfs',
      requestTimeoutMs: 5,
      fetchImpl,
    });

    await assert.rejects(
      storage.put({
        schemaVersion: 1,
        skillName: 'Distributed Systems',
        skillLevel: 'Advanced',
        issueDate: '2026-08-11T00:00:00.000Z',
        issuerAddress: '0x1111111111111111111111111111111111111111',
        learnerAddress: '0x2222222222222222222222222222222222222222',
      }),
      { message: 'IPFS request timed out' },
    );
  });
});
