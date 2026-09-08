import {
  credentialReferenceFromHash,
  hashCredential,
  type CredentialMetadata,
} from '@credora/credential-core';
import { credentialRegistryAbi } from '@credora/contracts';
import type { VerificationState } from '@credora/shared';
import { createPublicClient, defineChain, http, isAddress, type Hex } from 'viem';
import type { VerificationResult } from './verification-api';

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? process.env.CHAIN_ID ?? 31337);
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const registryAddress =
  process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS ?? process.env.CREDENTIAL_REGISTRY_ADDRESS;
const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ?? process.env.IPFS_GATEWAY_URL;

function unavailable(message: string): VerificationResult {
  return { state: 'ledger-unavailable', message, source: 'direct-rpc' };
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function metadataUrl(uri: string) {
  if (uri.startsWith('ipfs://') && gatewayUrl)
    return `${gatewayUrl.replace(/\/$/, '')}/${uri.slice('ipfs://'.length)}`;
  return undefined;
}

async function readMetadata(uri: string): Promise<CredentialMetadata> {
  const url = metadataUrl(uri);
  if (!url) throw new Error('No public metadata gateway is configured for this credential.');
  const headers = process.env.IPFS_GATEWAY_AUTH_TOKEN
    ? { authorization: `Bearer ${process.env.IPFS_GATEWAY_AUTH_TOKEN}` }
    : undefined;
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

export async function fetchDirectVerification(reference: string): Promise<VerificationResult> {
  let credentialHash: Hex;
  try {
    credentialHash = credentialReferenceFromHash(reference);
  } catch {
    return { state: 'malformed' satisfies VerificationState, source: 'direct-rpc' };
  }
  if (!registryAddress || !isAddress(registryAddress))
    return unavailable('Direct verification is not configured for this website.');

  const chain = defineChain({
    id: chainId,
    name: `Credora chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  let record;
  try {
    record = await client.readContract({
      address: registryAddress,
      abi: credentialRegistryAbi,
      functionName: 'getCredential',
      args: [credentialHash],
    });
  } catch {
    return unavailable('Unable to reach the credential registry directly right now.');
  }
  const [issuer, learner, metadataUri, , exists] = record;
  if (!exists) return { state: 'not-found', source: 'direct-rpc', credentialHash };
  if (!issuer || !learner || !metadataUri)
    return unavailable('The registry returned an incomplete credential record.');

  let metadata: CredentialMetadata;
  try {
    metadata = await readMetadata(metadataUri);
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
  return invalidMetadata(credentialHash, issuer, learner, metadataUri, metadata);
}
