import {
  credentialReferenceFromHash,
  hashCredential,
  hashOrganizationCredential,
  type CredentialMetadata,
  type OrganizationCredentialMetadata,
} from '@credora/credential-core';
import { createHash } from 'node:crypto';
import { credentialRegistryAbi, organizationCredentialRegistryAbi } from '@credora/contracts';
import type { VerificationState } from '@credora/shared';
import { createPublicClient, defineChain, http, isAddress, type Hex } from 'viem';
import type { VerificationResult } from './verification.server';

function verificationConfig() {
  const chainId = Number(
    process.env.VITE_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? process.env.CHAIN_ID ?? 31337,
  );
  const rpcUrl =
    process.env.VITE_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    process.env.RPC_URL ??
    'http://127.0.0.1:8545';
  const registryAddress =
    process.env.VITE_CREDENTIAL_REGISTRY_ADDRESS ??
    process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS ??
    process.env.CREDENTIAL_REGISTRY_ADDRESS;
  const organizationRegistryAddress =
    process.env.VITE_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS ??
    process.env.NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS ??
    process.env.ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS;
  const gatewayUrl =
    process.env.VITE_IPFS_GATEWAY_URL ??
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ??
    process.env.IPFS_GATEWAY_URL;
  return { chainId, rpcUrl, registryAddress, organizationRegistryAddress, gatewayUrl };
}

function unavailable(message: string): VerificationResult {
  return { state: 'ledger-unavailable', message, source: 'direct-rpc' };
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function metadataUrl(uri: string) {
  const { gatewayUrl } = verificationConfig();
  if (uri.startsWith('ipfs://') && gatewayUrl)
    return `${gatewayUrl.replace(/\/$/, '')}/${uri.slice('ipfs://'.length)}`;
  return undefined;
}

type DirectVerificationAdapters = {
  getChainId: () => Promise<number>;
  getLatestBlockIdentity: () => Promise<BlockIdentity | undefined>;
  getCanonicalBlockHash: (blockNumber: bigint) => Promise<Hex | undefined>;
  readLegacyRecord: (
    credentialHash: Hex,
    blockNumber: bigint,
  ) => Promise<readonly [string, string, string, bigint, boolean]>;
  readOrganizationRecord: (
    credentialHash: Hex,
    blockNumber: bigint,
  ) => Promise<readonly [Hex, string, string, string, bigint, boolean]>;
  readMetadata: (uri: string, credentialHash: Hex) => Promise<unknown>;
};

type BlockIdentity = { number: bigint; hash: Hex };

function createAdapters(
  rpcUrl: string,
  chainId: number,
  registryAddress: `0x${string}`,
  organizationRegistryAddress: `0x${string}`,
): DirectVerificationAdapters {
  const chain = defineChain({
    id: chainId,
    name: `Credora chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  return {
    getChainId: () => client.getChainId(),
    getLatestBlockIdentity: async () => {
      const block = await client.getBlock({ blockTag: 'latest' });
      return block.hash ? { number: block.number, hash: block.hash } : undefined;
    },
    getCanonicalBlockHash: async (blockNumber) => {
      const block = await client.getBlock({ blockNumber });
      return block.hash ?? undefined;
    },
    readLegacyRecord: (credentialHash, blockNumber) =>
      client.readContract({
        address: registryAddress,
        abi: credentialRegistryAbi,
        functionName: 'getCredential',
        args: [credentialHash],
        blockNumber,
      }),
    readOrganizationRecord: (credentialHash, blockNumber) =>
      client.readContract({
        address: organizationRegistryAddress,
        abi: organizationCredentialRegistryAbi,
        functionName: 'getCredential',
        args: [credentialHash],
        blockNumber,
      }),
    readMetadata: (uri, credentialHash) => readCredentialMetadata(uri, credentialHash),
  };
}

class MalformedMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedMetadataError';
  }
}

export async function readMetadata(uri: string): Promise<unknown> {
  if (uri.startsWith('local://'))
    throw new Error('Local metadata requires its credential reference for API transport.');
  const url = metadataUrl(uri);
  if (!url) throw new Error('No public metadata gateway is configured for this credential.');
  const authToken = process.env.IPFS_GATEWAY_AUTH_TOKEN;
  const headers = authToken ? { authorization: `Bearer ${authToken}` } : undefined;
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Metadata gateway returned ${response.status}.`);
  return readBoundedJson(response);
}

const maxMetadataResponseBytes = 1024 * 1024;

async function readBoundedJson(
  response: Response,
  malformedIsUnavailable = false,
): Promise<unknown> {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > maxMetadataResponseBytes)
    throw new Error('Metadata response exceeds the allowed size.');
  if (!response.body) throw new Error('Metadata response has no body.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxMetadataResponseBytes) {
        await reader.cancel();
        throw new Error('Metadata response exceeds the allowed size.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof SyntaxError && !malformedIsUnavailable)
      throw new MalformedMetadataError('Metadata response is not valid JSON.');
    if (error instanceof SyntaxError) throw new Error('Metadata source returned invalid JSON.');
    throw error;
  }
}

async function readLocalMetadata(uri: string, credentialHash: Hex): Promise<unknown> {
  const match = uri.match(/^local:\/\/(sha256-[a-f0-9]{64})$/);
  if (!match) throw new Error('Local metadata reference is malformed.');
  const apiUrl =
    process.env.VITE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    'http://127.0.0.1:4000';
  const response = await fetch(
    `${apiUrl.replace(/\/$/, '')}/credentials/${encodeURIComponent(credentialHash)}/verify`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) throw new Error(`Local metadata source returned ${response.status}.`);
  const body = await readBoundedJson(response, true);
  if (!isObject(body) || !Object.hasOwn(body, 'metadata'))
    throw new Error('Local metadata source did not provide metadata.');
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(body.metadata);
  } catch {
    throw new Error('Local metadata cannot be serialized for integrity checking.');
  }
  if (serialized === undefined)
    throw new Error('Local metadata cannot be serialized for integrity checking.');
  const digest = createHash('sha256').update(serialized, 'utf8').digest('hex');
  if (`sha256-${digest}` !== match[1])
    throw new Error('Local metadata digest does not match its URI.');
  return body.metadata;
}

export async function readCredentialMetadata(uri: string, credentialHash: Hex): Promise<unknown> {
  return uri.startsWith('local://') ? readLocalMetadata(uri, credentialHash) : readMetadata(uri);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isV1Metadata(value: unknown): value is CredentialMetadata {
  return (
    isObject(value) &&
    value.schemaVersion === 1 &&
    typeof value.issuerAddress === 'string' &&
    typeof value.learnerAddress === 'string' &&
    typeof value.skillName === 'string' &&
    typeof value.skillLevel === 'string' &&
    typeof value.issueDate === 'string' &&
    (value.credentialHash === undefined || typeof value.credentialHash === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.documentName === undefined || typeof value.documentName === 'string') &&
    (value.imageUri === undefined || typeof value.imageUri === 'string')
  );
}

function isV3Metadata(value: unknown): value is OrganizationCredentialMetadata {
  return (
    isObject(value) &&
    value.schemaVersion === 3 &&
    typeof value.organizationId === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(value.organizationId) &&
    typeof value.issuerAddress === 'string' &&
    typeof value.learnerAddress === 'string' &&
    typeof value.skillName === 'string' &&
    typeof value.skillLevel === 'string' &&
    typeof value.issueDate === 'string' &&
    (value.credentialHash === undefined || typeof value.credentialHash === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.imageUri === undefined || typeof value.imageUri === 'string')
  );
}

function malformedMetadata(
  credentialHash: Hex,
  issuer: string,
  learner: string,
  metadataUri: string,
) {
  return {
    state: 'metadata-malformed' as const,
    source: 'direct-rpc' as const,
    credentialHash,
    issuer,
    learner,
    metadataUri,
    message:
      'Credential proof found, but its public metadata is malformed or uses a different schema.',
  };
}

function unsupportedMetadataVersion(
  credentialHash: Hex,
  issuer: string,
  learner: string,
  metadataUri: string,
) {
  return {
    state: 'unsupported-version' as const,
    source: 'direct-rpc' as const,
    credentialHash,
    issuer,
    learner,
    metadataUri,
    message:
      'Credential proof found, but this direct verifier does not support its metadata version.',
  };
}

function invalidMetadata(
  credentialHash: Hex,
  issuer: string,
  learner: string,
  metadataUri: string,
  metadata: CredentialMetadata,
): VerificationResult {
  let valid = false;
  try {
    valid =
      hashCredential({
        issuerAddress: metadata.issuerAddress,
        learnerAddress: metadata.learnerAddress,
        skillName: metadata.skillName,
        skillLevel: metadata.skillLevel,
        issueDate: metadata.issueDate,
        metadataUri,
      }).toLowerCase() === credentialHash.toLowerCase() &&
      (!metadata.credentialHash ||
        metadata.credentialHash.toLowerCase() === credentialHash.toLowerCase()) &&
      sameAddress(metadata.issuerAddress, issuer) &&
      sameAddress(metadata.learnerAddress, learner);
  } catch {
    valid = false;
  }
  if (valid)
    return {
      state: 'valid',
      source: 'direct-rpc',
      credentialHash,
      issuer,
      learner,
      metadataUri,
      metadata: {
        schemaVersion: metadata.schemaVersion,
        issuerAddress: metadata.issuerAddress,
        learnerAddress: metadata.learnerAddress,
        skillName: metadata.skillName,
        skillLevel: metadata.skillLevel,
        issueDate: metadata.issueDate,
      },
      message: 'Credential hash-bound fields match the registry record and metadata.',
    };
  return {
    state: 'metadata-invalid',
    source: 'direct-rpc',
    credentialHash,
    issuer,
    learner,
    metadataUri,
    message: 'Credential proof found, but the metadata does not match the ledger record.',
  };
}

export async function fetchDirectVerification(
  reference: string,
  adapters?: DirectVerificationAdapters,
): Promise<VerificationResult> {
  const { chainId, rpcUrl, registryAddress, organizationRegistryAddress } = verificationConfig();
  let credentialHash: Hex;
  try {
    credentialHash = credentialReferenceFromHash(reference);
  } catch {
    return { state: 'malformed' satisfies VerificationState, source: 'direct-rpc' };
  }
  if (!registryAddress || !isAddress(registryAddress))
    return unavailable('Direct verification is not configured for this website.');
  if (!organizationRegistryAddress || !isAddress(organizationRegistryAddress))
    return unavailable(
      'The organization registry is not configured, so this credential cannot be conclusively checked.',
    );

  const direct =
    adapters ??
    createAdapters(
      rpcUrl,
      chainId,
      registryAddress as `0x${string}`,
      organizationRegistryAddress as `0x${string}`,
    );
  let record;
  let blockIdentity: BlockIdentity;
  try {
    const actualChainId = await direct.getChainId();
    if (actualChainId !== chainId)
      return unavailable(
        `The RPC is connected to chain ${actualChainId}, not configured chain ${chainId}.`,
      );
    const latestBlockIdentity = await direct.getLatestBlockIdentity();
    if (!latestBlockIdentity)
      return unavailable('Unable to establish a consistent block for direct verification.');
    blockIdentity = latestBlockIdentity;
    record = await direct.readLegacyRecord(credentialHash, blockIdentity.number);
  } catch {
    return unavailable('Unable to reach the credential registry directly right now.');
  }

  let organizationRecord;
  try {
    organizationRecord = await direct.readOrganizationRecord(credentialHash, blockIdentity.number);
  } catch {
    return unavailable(
      'Unable to check the organization registry, so this credential cannot be conclusively verified.',
    );
  }

  try {
    const canonicalHash = await direct.getCanonicalBlockHash(blockIdentity.number);
    if (!canonicalHash)
      return unavailable('Unable to confirm a consistent block for direct verification.');
    if (canonicalHash.toLowerCase() !== blockIdentity.hash.toLowerCase())
      return unavailable('The chain changed during direct verification; please retry the lookup.');
  } catch {
    return unavailable('Unable to confirm a consistent block for direct verification.');
  }

  const confirmPinnedBlock = async (): Promise<VerificationResult | undefined> => {
    try {
      const canonicalHash = await direct.getCanonicalBlockHash(blockIdentity.number);
      if (!canonicalHash)
        return unavailable('Unable to confirm a consistent block for direct verification.');
      if (canonicalHash.toLowerCase() !== blockIdentity.hash.toLowerCase())
        return unavailable(
          'The chain changed during direct verification; please retry the lookup.',
        );
      return undefined;
    } catch {
      return unavailable('Unable to confirm a consistent block for direct verification.');
    }
  };

  const [issuer, learner, metadataUri, , legacyExists] = record;
  const [
    organizationId,
    organizationIssuer,
    organizationLearner,
    organizationUri,
    ,
    organizationExists,
  ] = organizationRecord;
  if (legacyExists && organizationExists)
    return unavailable(
      'A credential hash exists in both registries; the collision cannot be resolved safely.',
    );
  const isOrganizationCredential = organizationExists;
  const boundIssuer = isOrganizationCredential ? organizationIssuer : issuer;
  const boundLearner = isOrganizationCredential ? organizationLearner : learner;
  const boundUri = isOrganizationCredential ? organizationUri : metadataUri;
  if (!legacyExists && !organizationExists)
    return { state: 'not-found', source: 'direct-rpc', credentialHash };
  if (!boundIssuer || !boundLearner || !boundUri)
    return unavailable('The registry returned an incomplete credential record.');

  let rawMetadata: unknown;
  try {
    rawMetadata = await direct.readMetadata(boundUri, credentialHash);
  } catch (error) {
    const reorg = await confirmPinnedBlock();
    if (reorg) return reorg;
    if (error instanceof MalformedMetadataError)
      return malformedMetadata(credentialHash, boundIssuer, boundLearner, boundUri);
    return {
      state: 'metadata-unavailable',
      source: 'direct-rpc',
      credentialHash,
      issuer: boundIssuer,
      learner: boundLearner,
      metadataUri: boundUri,
      message: 'Credential proof found, but its public metadata gateway is unavailable.',
    };
  }

  const metadata = isOrganizationCredential
    ? isV3Metadata(rawMetadata)
      ? rawMetadata
      : undefined
    : isV1Metadata(rawMetadata)
      ? rawMetadata
      : undefined;
  const reorg = await confirmPinnedBlock();
  if (reorg) return reorg;
  if (isObject(rawMetadata) && rawMetadata.schemaVersion === 2)
    return unsupportedMetadataVersion(credentialHash, boundIssuer, boundLearner, boundUri);
  if (!metadata) return malformedMetadata(credentialHash, boundIssuer, boundLearner, boundUri);

  if (!isOrganizationCredential)
    return invalidMetadata(
      credentialHash,
      boundIssuer,
      boundLearner,
      boundUri,
      metadata as CredentialMetadata,
    );

  const v3Metadata = metadata as OrganizationCredentialMetadata;
  let matches = false;
  try {
    matches =
      v3Metadata.organizationId.toLowerCase() === organizationId.toLowerCase() &&
      hashOrganizationCredential({
        organizationId: v3Metadata.organizationId,
        issuerAddress: v3Metadata.issuerAddress,
        learnerAddress: v3Metadata.learnerAddress,
        skillName: v3Metadata.skillName,
        skillLevel: v3Metadata.skillLevel,
        issueDate: v3Metadata.issueDate,
        metadataUri: boundUri,
      }).toLowerCase() === credentialHash.toLowerCase() &&
      (!v3Metadata.credentialHash ||
        v3Metadata.credentialHash.toLowerCase() === credentialHash.toLowerCase()) &&
      sameAddress(v3Metadata.issuerAddress, boundIssuer) &&
      sameAddress(v3Metadata.learnerAddress, boundLearner);
  } catch {
    matches = false;
  }
  if (!matches)
    return {
      state: 'metadata-invalid',
      source: 'direct-rpc',
      protocolVersion: 3,
      credentialHash,
      issuer: boundIssuer,
      learner: boundLearner,
      metadataUri: boundUri,
      message:
        'Credential proof found, but the v3 metadata does not match the organization registry record.',
    };
  return {
    state: 'valid',
    source: 'direct-rpc',
    protocolVersion: 3,
    credentialHash,
    issuer: boundIssuer,
    learner: boundLearner,
    metadataUri: boundUri,
    metadata: {
      schemaVersion: v3Metadata.schemaVersion,
      organizationId: v3Metadata.organizationId,
      issuerAddress: v3Metadata.issuerAddress,
      learnerAddress: v3Metadata.learnerAddress,
      skillName: v3Metadata.skillName,
      skillLevel: v3Metadata.skillLevel,
      issueDate: v3Metadata.issueDate,
    },
    message:
      'V3 hash-bound fields match the configured registry record. Issuer identity, recipient control, verified contract deployment, historical authority, and finality are unknown. The issue date is a metadata claim and is not proven by the registry issuedAt timestamp. Other metadata content was not verified.',
  };
}
