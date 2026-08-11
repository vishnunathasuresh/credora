import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem';
import type { VerificationState } from '@credora/shared';

export const CREDENTIAL_HASH_VERSION = 1 as const;

export type CredentialPayload = {
  version: typeof CREDENTIAL_HASH_VERSION;
  issuerAddress: Address;
  learnerAddress: Address;
  skillName: string;
  skillLevel: string;
  issueDate: string;
  metadataUri: string;
};

export type CredentialMetadata = {
  schemaVersion: 1;
  credentialHash: Hex;
  skillName: string;
  skillLevel: string;
  issueDate: string;
  issuerAddress: Address;
  learnerAddress: Address;
  description?: string;
  documentName?: string;
};

export type CredentialRecord = CredentialPayload & {
  credentialHash: Hex;
  transactionHash?: Hex;
  blockNumber?: bigint;
};

const hashParameters = parseAbiParameters(
  'uint8, address, address, string, string, uint64, string',
);

function normalizedText(value: string, field: string): string {
  const normalized = value.trim().normalize('NFC');
  if (!normalized) throw new Error(`${field} cannot be empty`);
  return normalized;
}

function issueDateSeconds(issueDate: string): bigint {
  const milliseconds = Date.parse(issueDate);
  if (!Number.isFinite(milliseconds)) throw new Error('issueDate must be a valid ISO date');
  return BigInt(Math.floor(milliseconds / 1000));
}

export function normalizeAddress(value: string, field: string): Address {
  if (!isAddress(value)) throw new Error(`${field} must be a valid EVM address`);
  return getAddress(value);
}

export function normalizePayload(input: Omit<CredentialPayload, 'version'>): CredentialPayload {
  return {
    version: CREDENTIAL_HASH_VERSION,
    issuerAddress: normalizeAddress(input.issuerAddress, 'issuerAddress'),
    learnerAddress: normalizeAddress(input.learnerAddress, 'learnerAddress'),
    skillName: normalizedText(input.skillName, 'skillName'),
    skillLevel: normalizedText(input.skillLevel, 'skillLevel'),
    issueDate: new Date(Number(issueDateSeconds(input.issueDate) * 1000n)).toISOString(),
    metadataUri: normalizedText(input.metadataUri, 'metadataUri'),
  };
}

export function hashCredential(input: Omit<CredentialPayload, 'version'>): Hex {
  const payload = normalizePayload(input);
  return keccak256(
    encodeAbiParameters(hashParameters, [
      payload.version,
      payload.issuerAddress,
      payload.learnerAddress,
      payload.skillName,
      payload.skillLevel,
      issueDateSeconds(payload.issueDate),
      payload.metadataUri,
    ]),
  );
}

export function credentialReferenceFromHash(value: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value))
    throw new Error('credential reference must be a 32-byte hash');
  return value as Hex;
}

export function verificationMessage(state: VerificationState): string {
  switch (state) {
    case 'valid':
      return 'Credential verified against the immutable ledger.';
    case 'not-found':
      return 'No credential with this reference exists on the selected ledger.';
    case 'metadata-unavailable':
      return 'Credential proof found, but metadata is temporarily unavailable.';
    case 'ledger-unavailable':
      return 'Unable to reach the credential ledger right now.';
    default:
      return 'The credential reference could not be processed.';
  }
}
