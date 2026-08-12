import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FileStorage } from './index.js';

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
