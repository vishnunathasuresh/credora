import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  parseAbiParameters,
  concatHex,
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
  /** Optional compatibility field; the canonical hash is derived from the metadata URI. */
  credentialHash?: Hex;
  skillName: string;
  skillLevel: string;
  issueDate: string;
  issuerAddress: Address;
  learnerAddress: Address;
  description?: string;
  documentName?: string;
};

/** Public v2 manifest: claim values may remain with the holder while the root
 * is published and bound to the on-chain credential hash. */
export type SelectiveCredentialMetadata = {
  schemaVersion: 2;
  credentialHash?: Hex;
  issuerAddress: Address;
  learnerAddress: Address;
  issueDate: string;
  claimsRoot: Hex;
  publicClaims?: Record<string, string>;
};

export type CredentialRecord = CredentialPayload & {
  credentialHash: Hex;
  transactionHash?: Hex;
  blockNumber?: bigint;
};

/**
 * A claim committed into a selective-disclosure Merkle tree. The salt keeps
 * low-entropy values (for example, common skill levels) from being guessed
 * from a published commitment.
 */
export type DisclosureClaim = {
  name: string;
  value: string;
  salt: Hex;
};

export type DisclosureProof = {
  claim: DisclosureClaim;
  siblings: Hex[];
};

export type SelectiveDisclosure = {
  version: 1;
  credentialHash: Hex;
  claimsRoot: Hex;
  proofs: DisclosureProof[];
};

export type SelectiveCredentialPayload = {
  version: 2;
  issuerAddress: Address;
  learnerAddress: Address;
  issueDate: string;
  metadataUri: string;
  claimsRoot: Hex;
};

const hashParameters = parseAbiParameters(
  'uint8, address, address, string, string, uint64, string',
);
const selectiveHashParameters = parseAbiParameters(
  'uint8, address, address, uint64, string, bytes32',
);
const claimParameters = parseAbiParameters('string, string, bytes32');

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

export function normalizeIssueDate(issueDate: string): string {
  return new Date(Number(issueDateSeconds(issueDate) * 1000n)).toISOString();
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
    issueDate: normalizeIssueDate(input.issueDate),
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

export function hashSelectiveCredential(input: Omit<SelectiveCredentialPayload, 'version'>): Hex {
  const issuerAddress = normalizeAddress(input.issuerAddress, 'issuerAddress');
  const learnerAddress = normalizeAddress(input.learnerAddress, 'learnerAddress');
  const issueDate = normalizeIssueDate(input.issueDate);
  const metadataUri = normalizedText(input.metadataUri, 'metadataUri');
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.claimsRoot))
    throw new Error('claimsRoot must be a 32-byte hash');
  return keccak256(
    encodeAbiParameters(selectiveHashParameters, [
      2,
      issuerAddress,
      learnerAddress,
      issueDateSeconds(issueDate),
      metadataUri,
      input.claimsRoot,
    ]),
  );
}

function normalizedClaimName(name: string): string {
  return normalizedText(name, 'claim name');
}

function claimLeaf(claim: DisclosureClaim): Hex {
  return keccak256(
    encodeAbiParameters(claimParameters, [
      normalizedClaimName(claim.name),
      normalizedText(claim.value, `claim ${claim.name}`),
      claim.salt,
    ]),
  );
}

function orderedPair(left: Hex, right: Hex): Hex {
  return left.toLowerCase() <= right.toLowerCase()
    ? keccak256(concatHex([left, right]))
    : keccak256(concatHex([right, left]));
}

function validateClaims(claims: DisclosureClaim[]): DisclosureClaim[] {
  if (!claims.length) throw new Error('at least one disclosure claim is required');
  const names = new Set<string>();
  return claims.map((claim) => {
    const normalized = {
      name: normalizedClaimName(claim.name),
      value: normalizedText(claim.value, `claim ${claim.name}`),
      salt: claim.salt,
    };
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized.salt))
      throw new Error(`claim ${normalized.name} salt must be a 32-byte value`);
    if (names.has(normalized.name)) throw new Error(`duplicate claim ${normalized.name}`);
    names.add(normalized.name);
    return normalized;
  });
}

/** Build a deterministic, sorted Merkle root for a complete claim set. */
export function claimsRoot(claims: DisclosureClaim[]): Hex {
  let level = validateClaims(claims)
    .map(claimLeaf)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let index = 0; index < level.length; index += 2)
      next.push(orderedPair(level[index], level[index + 1] ?? level[index]));
    level = next;
  }
  return level[0];
}

/** Create proofs for only the selected claim names; unselected values stay local to the holder. */
export function createSelectiveDisclosure(input: {
  credentialHash: Hex;
  claims: DisclosureClaim[];
  reveal: string[];
}): SelectiveDisclosure {
  const normalizedClaims = validateClaims(input.claims);
  const root = claimsRoot(normalizedClaims);
  const reveal = new Set(input.reveal.map(normalizedClaimName));
  if (!reveal.size) throw new Error('at least one claim must be revealed');
  for (const name of reveal)
    if (!normalizedClaims.some((claim) => claim.name === name))
      throw new Error(`cannot reveal unknown claim ${name}`);

  const leaves = normalizedClaims
    .map((claim) => ({ claim, leaf: claimLeaf(claim) }))
    .sort((a, b) => a.leaf.toLowerCase().localeCompare(b.leaf.toLowerCase()));
  const proofs = normalizedClaims
    .filter((claim) => reveal.has(claim.name))
    .map((claim) => {
      let index = leaves.findIndex((item) => item.claim.name === claim.name);
      let level = leaves.map((item) => item.leaf);
      const siblings: Hex[] = [];
      while (level.length > 1) {
        siblings.push(level[index % 2 === 0 ? index + 1 : index - 1] ?? level[index]);
        const next: Hex[] = [];
        for (let cursor = 0; cursor < level.length; cursor += 2)
          next.push(orderedPair(level[cursor], level[cursor + 1] ?? level[cursor]));
        index = Math.floor(index / 2);
        level = next;
      }
      return { claim, siblings };
    });
  return { version: 1, credentialHash: input.credentialHash, claimsRoot: root, proofs };
}

export function verifySelectiveDisclosure(
  disclosure: SelectiveDisclosure,
  expectedClaimsRoot: Hex,
): boolean {
  if (
    disclosure.version !== 1 ||
    disclosure.claimsRoot.toLowerCase() !== expectedClaimsRoot.toLowerCase()
  )
    return false;
  if (!disclosure.proofs.length) return false;
  return disclosure.proofs.every(({ claim, siblings }) => {
    let current = claimLeaf(claim);
    for (const sibling of siblings) current = orderedPair(current, sibling);
    return current.toLowerCase() === disclosure.claimsRoot.toLowerCase();
  });
}

/** Verify a presentation and prove that its root is bound to the v2 ledger hash. */
export function verifySelectiveDisclosureForCredential(
  disclosure: SelectiveDisclosure,
  payload: Omit<SelectiveCredentialPayload, 'version' | 'claimsRoot'>,
): boolean {
  if (
    disclosure.credentialHash.toLowerCase() !==
    hashSelectiveCredential({ ...payload, claimsRoot: disclosure.claimsRoot }).toLowerCase()
  )
    return false;
  return verifySelectiveDisclosure(disclosure, disclosure.claimsRoot);
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
    case 'metadata-invalid':
      return 'Credential proof found, but the metadata does not match the ledger record.';
    case 'ledger-unavailable':
      return 'Unable to reach the credential ledger right now.';
    default:
      return 'The credential reference could not be processed.';
  }
}
