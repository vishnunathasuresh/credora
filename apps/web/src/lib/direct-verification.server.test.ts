import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hashCredential,
  hashOrganizationCredential,
  type CredentialMetadata,
  type OrganizationCredentialMetadata,
} from '@credora/credential-core';
import type { Hex } from 'viem';
import {
  fetchDirectVerification,
  readCredentialMetadata,
  readMetadata,
} from './direct-verification.server';
import { FileStorage } from '../../../../packages/storage/src/index';
import { fetchVerification, shouldLookupIssuerProfile } from './verification.server';

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
const organizationId = `0x${'12'.repeat(32)}` as Hex;
const v3Metadata: OrganizationCredentialMetadata = {
  schemaVersion: 3,
  organizationId,
  issuerAddress: issuer,
  learnerAddress: learner,
  skillName: metadata.skillName,
  skillLevel: metadata.skillLevel,
  issueDate: metadata.issueDate,
};
const v3CredentialHash = hashOrganizationCredential({ ...v3Metadata, metadataUri });
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
  organizationId,
  issuer,
  learner,
  metadataUri,
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
  'VITE_IPFS_GATEWAY_URL',
  'VITE_API_URL',
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
  manifest = metadata,
  metadataError,
  readMetadata: readMetadataAdapter,
}: {
  legacy?: LegacyRecord;
  organization?: OrganizationRecord;
  organizationError?: Error;
  latestBlock?: typeof blockIdentity | null;
  canonicalBlockHash?: Hex | null;
  manifest?: unknown;
  metadataError?: Error;
  readMetadata?: (uri: string, hash: Hex) => Promise<unknown>;
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
    readMetadata: async (uri: string, hash: Hex) => {
      if (readMetadataAdapter) return readMetadataAdapter(uri, hash);
      if (metadataError) throw metadataError;
      return manifest;
    },
  };
}

test('an organization-only hash is checked as a v3 credential', async () => {
  const result = await fetchDirectVerification(
    v3CredentialHash,
    adapters({ organization: presentOrganizationRecord, manifest: v3Metadata }),
  );
  assert.equal(result.state, 'valid');
  assert.equal(result.protocolVersion, 3);
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

test('v1 substitutions limited to unbound presentation fields do not affect proof and are omitted', async (t) => {
  for (const [field, value] of [
    ['description', 'Substituted description'],
    ['documentName', 'Substituted file name'],
    ['imageUri', 'https://attacker.example/image.png'],
    ['unrecognized', { injected: true }],
  ] as const) {
    await t.test(field, async () => {
      const result = await fetchDirectVerification(
        credentialHash,
        adapters({ legacy: presentLegacyRecord, manifest: { ...metadata, [field]: value } }),
      );
      assert.equal(result.state, 'valid');
      assert.deepEqual(result.metadata, {
        schemaVersion: 1,
        issuerAddress: issuer,
        learnerAddress: learner,
        skillName: metadata.skillName,
        skillLevel: metadata.skillLevel,
        issueDate: metadata.issueDate,
      });
      assert.doesNotMatch(JSON.stringify(result), /Substituted|attacker\.example|injected/);
    });
  }
});

test('local FileStorage v1 roundtrip uses API metadata only and ignores its proof fields', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'credora-direct-verify-'));
  const storage = new FileStorage(directory);
  const stored = await storage.put(metadata);
  const hash = hashCredential({ ...metadata, metadataUri: stored.uri });
  const originalFetch = globalThis.fetch;
  process.env.VITE_API_URL = 'http://api.example.test';
  let requestUrl = '';
  globalThis.fetch = (async (input) => {
    requestUrl = String(input);
    return Response.json({
      state: 'not-found',
      credentialHash: `0x${'ff'.repeat(32)}`,
      issuer: learner,
      learner: issuer,
      metadataUri: 'local://forged',
      protocolVersion: 3,
      metadata: await storage.get(stored.uri),
    });
  }) as typeof fetch;
  try {
    const result = await fetchDirectVerification(
      hash,
      adapters({
        legacy: [issuer, learner, stored.uri, 1n, true],
        readMetadata: readCredentialMetadata,
      }),
    );
    assert.equal(requestUrl, `http://api.example.test/credentials/${hash}/verify`);
    assert.equal(result.state, 'valid');
    assert.equal(result.protocolVersion, undefined);
    assert.equal(result.issuer, issuer);
    assert.equal(result.learner, learner);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('local FileStorage v3 roundtrip verifies organization-bound fields', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'credora-direct-verify-'));
  const storage = new FileStorage(directory);
  const stored = await storage.put(v3Metadata);
  const hash = hashOrganizationCredential({ ...v3Metadata, metadataUri: stored.uri });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      state: 'metadata-invalid',
      metadata: await storage.get(stored.uri),
    })) as typeof fetch;
  try {
    const result = await fetchDirectVerification(
      hash,
      adapters({
        organization: [organizationId, issuer, learner, stored.uri, 0n, true],
        readMetadata: readCredentialMetadata,
      }),
    );
    assert.equal(result.state, 'valid');
    assert.equal(result.protocolVersion, 3);
    assert.equal(result.metadata?.schemaVersion, 3);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a local metadata digest mismatch is unavailable even when the API says valid', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'credora-direct-verify-'));
  const storage = new FileStorage(directory);
  const stored = await storage.put(metadata);
  const hash = hashCredential({ ...metadata, metadataUri: stored.uri });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      state: 'valid',
      metadata: { ...metadata, skillName: 'Forged skill' },
    })) as typeof fetch;
  try {
    const result = await fetchDirectVerification(
      hash,
      adapters({
        legacy: [issuer, learner, stored.uri, 1n, true],
        readMetadata: readCredentialMetadata,
      }),
    );
    assert.equal(result.state, 'metadata-unavailable');
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('local metadata API refusal and timeout remain metadata unavailable', async (t) => {
  for (const [name, mockedFetch] of [
    ['refusal', async () => new Response('{}', { status: 503 })],
    [
      'timeout',
      async () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
    ],
  ] as const) {
    await t.test(name, async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockedFetch as typeof fetch;
      try {
        const result = await fetchDirectVerification(
          credentialHash,
          adapters({
            legacy: [issuer, learner, 'local://sha256-' + 'a'.repeat(64), 1n, true],
            readMetadata: readCredentialMetadata,
          }),
        );
        assert.equal(result.state, 'metadata-unavailable');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  }
});

test('a legacy proof is unavailable when the organization registry has a hash collision', async () => {
  const result = await fetchDirectVerification(
    credentialHash,
    adapters({ legacy: presentLegacyRecord, organization: presentOrganizationRecord }),
  );
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /collision/);
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

test('a valid v3 proof is verified from the organization registry and v3 manifest', async () => {
  const result = await fetchDirectVerification(
    v3CredentialHash,
    adapters({ organization: presentOrganizationRecord, manifest: v3Metadata }),
  );
  assert.equal(result.state, 'valid');
  assert.equal(result.protocolVersion, 3);
  assert.equal(result.credentialHash, v3CredentialHash);
  assert.equal(result.issuer, issuer);
  assert.equal(result.learner, learner);
  assert.equal(result.metadataUri, metadataUri);
  assert.match(result.message ?? '', /issuer identity.*unknown/i);
  assert.match(result.message ?? '', /issue date is a metadata claim/i);
});

test('v3 substitutions limited to unbound presentation fields do not affect proof and are omitted', async (t) => {
  for (const [field, value] of [
    ['description', 'Substituted description'],
    ['imageUri', 'https://attacker.example/image.png'],
    ['unrecognized', { injected: true }],
  ] as const) {
    await t.test(field, async () => {
      const result = await fetchDirectVerification(
        v3CredentialHash,
        adapters({
          organization: presentOrganizationRecord,
          manifest: { ...v3Metadata, [field]: value },
        }),
      );
      assert.equal(result.state, 'valid');
      assert.deepEqual(result.metadata, {
        schemaVersion: 3,
        organizationId,
        issuerAddress: issuer,
        learnerAddress: learner,
        skillName: v3Metadata.skillName,
        skillLevel: v3Metadata.skillLevel,
        issueDate: v3Metadata.issueDate,
      });
      assert.doesNotMatch(JSON.stringify(result), /Substituted|attacker\.example|injected/);
    });
  }
});

test('tampering with a v3 organization-bound manifest field is a mismatch', async () => {
  const result = await fetchDirectVerification(
    v3CredentialHash,
    adapters({
      organization: presentOrganizationRecord,
      manifest: { ...v3Metadata, organizationId: `0x${'34'.repeat(32)}` },
    }),
  );
  assert.equal(result.state, 'metadata-invalid');
  assert.equal(result.protocolVersion, 3);
});

test('a v3 manifest optional credential hash must match the lookup reference', async () => {
  const result = await fetchDirectVerification(
    v3CredentialHash,
    adapters({
      organization: presentOrganizationRecord,
      manifest: { ...v3Metadata, credentialHash },
    }),
  );
  assert.equal(result.state, 'metadata-invalid');
});

test('v3 bound-field mutations do not verify', async (t) => {
  const mutations: Array<[string, unknown]> = [
    ['issuerAddress', '0x0000000000000000000000000000000000000005'],
    ['learnerAddress', '0x0000000000000000000000000000000000000006'],
    ['skillName', 'Different skill'],
    ['skillLevel', 'Beginner'],
    ['issueDate', '2026-10-02T00:00:00.000Z'],
  ];
  for (const [field, value] of mutations) {
    await t.test(field, async () => {
      const result = await fetchDirectVerification(
        v3CredentialHash,
        adapters({
          organization: presentOrganizationRecord,
          manifest: { ...v3Metadata, [field]: value },
        }),
      );
      assert.equal(result.state, 'metadata-invalid');
    });
  }
});

test('v3 optional presentation fields must be strings', async (t) => {
  for (const field of ['description', 'imageUri']) {
    await t.test(field, async () => {
      const result = await fetchDirectVerification(
        v3CredentialHash,
        adapters({
          organization: presentOrganizationRecord,
          manifest: { ...v3Metadata, [field]: { unsafe: true } },
        }),
      );
      assert.equal(result.state, 'metadata-malformed');
      assert.equal(result.metadata, undefined);
    });
  }
});

test('a hash absent from both registries remains not found', async () => {
  const result = await fetchDirectVerification(v3CredentialHash, adapters());
  assert.equal(result.state, 'not-found');
});

test('a v3 metadata gateway failure remains distinct from a malformed manifest', async () => {
  const unavailable = await fetchDirectVerification(
    v3CredentialHash,
    adapters({ organization: presentOrganizationRecord, metadataError: new Error('gateway down') }),
  );
  const malformed = await fetchDirectVerification(
    v3CredentialHash,
    adapters({ organization: presentOrganizationRecord, manifest: '{not-json' }),
  );
  assert.equal(unavailable.state, 'metadata-unavailable');
  assert.equal(malformed.state, 'metadata-malformed');
});

test('a v3 record with a v2 manifest is unsupported instead of silently downgraded', async () => {
  const result = await fetchDirectVerification(
    v3CredentialHash,
    adapters({
      organization: presentOrganizationRecord,
      manifest: { schemaVersion: 2, issuerAddress: issuer, learnerAddress: learner },
    }),
  );
  assert.equal(result.state, 'unsupported-version');
});

test('a v3 credential remains unavailable if the pinned block changes during metadata fetch', async () => {
  const hashes = [blockIdentity.hash, `0x${'cd'.repeat(32)}` as Hex];
  const result = await fetchDirectVerification(v3CredentialHash, {
    ...adapters({ organization: presentOrganizationRecord, manifest: v3Metadata }),
    getCanonicalBlockHash: async () => hashes.shift(),
  });
  assert.equal(result.state, 'ledger-unavailable');
  assert.match(result.message ?? '', /chain changed/);
});

test('an API v3 success cannot bypass direct collision or unavailability outcomes', async (t) => {
  const scenarios = [
    {
      name: 'registry collision',
      source: adapters({ legacy: presentLegacyRecord, organization: presentOrganizationRecord }),
      message: /collision/,
    },
    {
      name: 'organization registry unavailable',
      source: adapters({ organizationError: new Error('rpc down') }),
      message: /cannot be conclusively verified/,
    },
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const previousFetch = globalThis.fetch;
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ state: 'valid', protocolVersion: 3 }), {
          status: 200,
        })) as typeof fetch;
      try {
        const result = await fetchVerification(v3CredentialHash, (reference) =>
          fetchDirectVerification(reference, scenario.source),
        );
        assert.equal(result.state, 'ledger-unavailable');
        assert.match(result.message ?? '', scenario.message);
      } finally {
        globalThis.fetch = previousFetch;
      }
    });
  }
});

test('v3 issuer profiles are never selected by address alone across organizations', () => {
  const organizationIds = [`0x${'12'.repeat(32)}`, `0x${'34'.repeat(32)}`];
  const sameIssuer = issuer;
  for (const id of organizationIds) {
    assert.equal(
      shouldLookupIssuerProfile({
        state: 'valid',
        protocolVersion: 3,
        issuer: sameIssuer,
        metadata: { ...v3Metadata, organizationId: id as Hex },
      }),
      false,
    );
  }
});

test('metadata JSON parse errors remain malformed metadata', async () => {
  const previousFetch = globalThis.fetch;
  const previousGateway = process.env.VITE_IPFS_GATEWAY_URL;
  process.env.VITE_IPFS_GATEWAY_URL = 'https://gateway.example/ipfs';
  globalThis.fetch = (async () => new Response('{not-json')) as typeof fetch;
  try {
    await assert.rejects(readMetadata(metadataUri), {
      name: 'MalformedMetadataError',
      message: 'Metadata response is not valid JSON.',
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousGateway === undefined) delete process.env.VITE_IPFS_GATEWAY_URL;
    else process.env.VITE_IPFS_GATEWAY_URL = previousGateway;
  }
});

test('IPFS metadata remains independent of the API transport', async () => {
  const previousFetch = globalThis.fetch;
  const previousGateway = process.env.VITE_IPFS_GATEWAY_URL;
  process.env.VITE_IPFS_GATEWAY_URL = 'https://gateway.example/ipfs';
  const requests: string[] = [];
  globalThis.fetch = (async (input) => {
    requests.push(String(input));
    return Response.json(metadata);
  }) as typeof fetch;
  try {
    const result = await readCredentialMetadata(metadataUri, credentialHash);
    assert.deepEqual(requests, ['https://gateway.example/ipfs/bafybeigdyrzt']);
    assert.deepEqual(result, metadata);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousGateway === undefined) delete process.env.VITE_IPFS_GATEWAY_URL;
    else process.env.VITE_IPFS_GATEWAY_URL = previousGateway;
  }
});

test('IPFS metadata response bodies are bounded', async () => {
  const previousFetch = globalThis.fetch;
  const previousGateway = process.env.VITE_IPFS_GATEWAY_URL;
  process.env.VITE_IPFS_GATEWAY_URL = 'https://gateway.example/ipfs';
  globalThis.fetch = (async () =>
    new Response('{}', { headers: { 'content-length': String(1024 * 1024 + 1) } })) as typeof fetch;
  try {
    await assert.rejects(readMetadata(metadataUri), /exceeds the allowed size/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousGateway === undefined) delete process.env.VITE_IPFS_GATEWAY_URL;
    else process.env.VITE_IPFS_GATEWAY_URL = previousGateway;
  }
});

test('v3 metadata failure, malformed metadata, and unsupported schema all recheck the pinned block', async (t) => {
  const scenarios = [
    { name: 'gateway failure', options: { metadataError: new Error('offline') } },
    { name: 'malformed metadata', options: { manifest: '{not-json' } },
    {
      name: 'unsupported metadata',
      options: { manifest: { schemaVersion: 2, issuerAddress: issuer, learnerAddress: learner } },
    },
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const hashes = [blockIdentity.hash, `0x${'cd'.repeat(32)}` as Hex];
      const result = await fetchDirectVerification(v3CredentialHash, {
        ...adapters({ organization: presentOrganizationRecord, ...scenario.options }),
        getCanonicalBlockHash: async () => hashes.shift(),
      });
      assert.equal(result.state, 'ledger-unavailable');
      assert.match(result.message ?? '', /chain changed/);
    });
  }
});
