import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { hashCredential, type CredentialMetadata } from '@credora/credential-core';
import type { Hex } from 'viem';
import { fetchDirectVerification } from './direct-verification.server';

const registryAddress = '0x0000000000000000000000000000000000000001';
const organizationRegistryAddress = '0x0000000000000000000000000000000000000002';
const issuer = '0x0000000000000000000000000000000000000003';
const learner = '0x0000000000000000000000000000000000000004';
const metadataUri = 'ipfs://bafybeigdyrzt';
const metadata: CredentialMetadata = {
  schemaVersion: 1,
  issuerAddress: issuer,
  learnerAddress: learner,
  skillName: 'Safety review',
  skillLevel: 'Advanced',
  issueDate: '2026-10-01T00:00:00.000Z',
};
const credentialHash = hashCredential({ ...metadata, metadataUri });
type LegacyRecord = readonly [string, string, string, bigint, boolean];
type OrganizationRecord = readonly [Hex, string, string, string, bigint, boolean];
const blockIdentity = { number: 42n, hash: `0x${'ab'.repeat(32)}` as Hex };

const absentLegacyRecord: LegacyRecord = [
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000000',
  '',
  0n,
  false,
];
const presentLegacyRecord: LegacyRecord = [issuer, learner, metadataUri, 1n, true];
const absentOrganizationRecord: OrganizationRecord = [
  `0x${'00'.repeat(32)}`,
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000000',
  '',
  0n,
  false,
];
const presentOrganizationRecord: OrganizationRecord = [
  `0x${'00'.repeat(32)}`,
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000000',
  '',
  0n,
  true,
];

const envKeys = [
  'VITE_CHAIN_ID',
  'NEXT_PUBLIC_CHAIN_ID',
  'CHAIN_ID',
  'VITE_CREDENTIAL_REGISTRY_ADDRESS',
  'NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS',
  'CREDENTIAL_REGISTRY_ADDRESS',
  'VITE_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS',
  'NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS',
  'ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS',
] as const;
const oldEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

before(() => {
  for (const key of envKeys) delete process.env[key];
  process.env.VITE_CHAIN_ID = '31337';
  process.env.VITE_CREDENTIAL_REGISTRY_ADDRESS = registryAddress;
  process.env.VITE_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS = organizationRegistryAddress;
});

after(() => {
  for (const key of envKeys) {
    const previous = oldEnv.get(key);
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

function adapters({
  legacy = absentLegacyRecord,
  organization = absentOrganizationRecord,
  organizationError,
  latestBlock = blockIdentity,
  canonicalBlockHash = blockIdentity.hash,
}: {
  legacy?: LegacyRecord;
  organization?: OrganizationRecord;
  organizationError?: Error;
  latestBlock?: typeof blockIdentity | null;
  canonicalBlockHash?: Hex | null;
} = {}) {
  return {
    getChainId: async () => 31337,
    getLatestBlockIdentity: async () => latestBlock ?? undefined,
    getCanonicalBlockHash: async (_blockNumber: bigint) => canonicalBlockHash ?? undefined,
    readLegacyRecord: async (_hash: Hex, _blockNumber: bigint) => legacy,
    readOrganizationRecord: async (_hash: Hex, _blockNumber: bigint) => {
      if (organizationError) throw organizationError;
      return organization;
    },
    readMetadata: async (_uri: string) => metadata,
  };
}

test('an absent legacy hash is unavailable when the organization registry contains it', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ organization: presentOrganizationRecord }),
  );
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /organization registry/);
});

test('an absent legacy hash is unavailable when the organization registry cannot be read', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ organizationError: new Error('rpc down') }),
  );
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /cannot be conclusively verified/);
});

test('an absent organization registry configuration is unavailable and is not queried', async () => {
  delete process.env.VITE_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS;
  let organizationRead = false;
  try {
    const source = adapters({ legacy: presentLegacyRecord });
    const result = await fetchDirectVerification(credentialHash, {
      ...source,
      readOrganizationRecord: async (hash, blockNumber) => {
        organizationRead = true;
        return source.readOrganizationRecord(hash, blockNumber);
      },
    });
    assert.equal(result.state, 'ledger-unavailable');
    assert.match(result.message ?? '', /not configured/);
    assert.equal(organizationRead, false);
  } finally {
    process.env.VITE_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS = organizationRegistryAddress;
  }
});

test('not-found requires successful absence checks in both registries', async () => {
  const result = await fetchDirectVerification(credentialHash, adapters());
  assert.equal(result.state, 'not-found');
  assert.equal(result.credentialHash, credentialHash);
});

test('both registry reads use one pinned block and the canonical block hash is rechecked', async () => {
  const readBlockNumbers: bigint[] = [];
  const checkedBlockNumbers: bigint[] = [];
  const source = adapters();
  const result = await fetchDirectVerification(credentialHash, {
    ...source,
    getLatestBlockIdentity: async () => blockIdentity,
    getCanonicalBlockHash: async (blockNumber) => {
      checkedBlockNumbers.push(blockNumber);
      return blockIdentity.hash;
    },
    readLegacyRecord: async (hash, blockNumber) => {
      readBlockNumbers.push(blockNumber);
      return source.readLegacyRecord(hash, blockNumber);
    },
    readOrganizationRecord: async (hash, blockNumber) => {
      readBlockNumbers.push(blockNumber);
      return source.readOrganizationRecord(hash, blockNumber);
    },
  });

  assert.equal(result.state, 'not-found');
  assert.deepEqual(readBlockNumbers, [blockIdentity.number, blockIdentity.number]);
  assert.deepEqual(checkedBlockNumbers, [blockIdentity.number]);
});

test('a changed canonical block hash makes the lookup unavailable', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ canonicalBlockHash: `0x${'cd'.repeat(32)}` }),
  );
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /chain changed/);
});

test('a block change while fetching metadata prevents a valid result', async () => {
  const canonicalHashes = [blockIdentity.hash, `0x${'cd'.repeat(32)}` as Hex];
  const source = adapters({ legacy: presentLegacyRecord });
  const result = await fetchDirectVerification(credentialHash, {
    ...source,
    getCanonicalBlockHash: async () => canonicalHashes.shift(),
  });
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /chain changed/);
});

test('an unavailable block identity makes the lookup unavailable', async () => {
  const result = await fetchDirectVerification(credentialHash, adapters({ latestBlock: null }));
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /consistent block/);
});

test('an unavailable canonical block hash makes the lookup unavailable', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ canonicalBlockHash: null }),
  );
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /confirm a consistent block/);
});

test('a valid legacy proof remains valid after both registries are checked', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ legacy: presentLegacyRecord }),
  );
  assert.equal(result.state, 'valid');
  assert.equal(result.credentialHash, credentialHash);
});

test('a legacy proof is unavailable when the organization registry has a hash collision', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ legacy: presentLegacyRecord, organization: presentOrganizationRecord }),
  );
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /cannot verify v3 credentials/);
});

test('a legacy proof is unavailable when organization registry lookup fails', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ legacy: presentLegacyRecord, organizationError: new Error('rpc down') }),
  );
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /cannot be conclusively verified/);
});

test('a mismatched RPC chain is unavailable before any registry lookup', async () => {
  let legacyRead = false;
  const source = adapters();
  const result = await fetchDirectVerification(credentialHash, {
    ...source,
    getChainId: async () => 1,
    readLegacyRecord: async (hash, blockNumber) => {
      legacyRead = true;
      return source.readLegacyRecord(hash, blockNumber);
    },
  });
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /not configured chain/);
  assert.equal(legacyRead, false);
});
