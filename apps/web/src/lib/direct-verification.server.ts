import {
  credentialReferenceFromHash,
  hashCredential,
  type CredentialMetadata,
} from '@credora/credential-core';
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
  readMetadata: typeof readMetadata;
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
    readMetadata,
  };
}

async function readMetadata(uri: string): Promise<CredentialMetadata> {
  const url = metadataUrl(uri);
  if (!url) throw new Error('No public metadata gateway is configured for this credential.');
  const authToken = process.env.IPFS_GATEWAY_AUTH_TOKEN;
  const headers = authToken ? { authorization: `Bearer ${authToken}` } : undefined;
  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`Metadata gateway returned ${response.status}.`);
  return (await response.json()) as CredentialMetadata;
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
      metadata,
      message: 'Credential verified directly against the registry and metadata gateway.',
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

  if (organizationRecord[5])
    return unavailable(
      'A record exists in the organization registry, but this direct fallback cannot verify v3 credentials.',
    );

  const [issuer, learner, metadataUri, , exists] = record;
  if (!exists) return { state: 'not-found', source: 'direct-rpc', credentialHash };
  if (!issuer || !learner || !metadataUri)
    return unavailable('The registry returned an incomplete credential record.');

  let metadata: CredentialMetadata;
  try {
    metadata = await direct.readMetadata(metadataUri);
  } catch {
    return {
      state: 'metadata-unavailable',
      source: 'direct-rpc',
      credentialHash,
      issuer,
      learner,
      metadataUri,
      message: 'Credential proof found, but its public metadata gateway is unavailable.',
    };
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

  return invalidMetadata(credentialHash, issuer, learner, metadataUri, metadata);
}
