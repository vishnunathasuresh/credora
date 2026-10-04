import { normalizePayload, type CredentialMetadata } from '@credora/credential-core';
import { parseCredentialReference, type VerificationState } from '@credora/shared';
export const parseReference = parseCredentialReference;

export type VerificationResult = {
  state: VerificationState | 'service-unavailable';
  message: string;
  metadata?: CredentialMetadata;
};
export type SavedCredential = {
  hash: string;
  name: string;
  savedAt: string;
  metadata?: CredentialMetadata;
};
export type WalletShare = {
  id: string;
  token: string;
  managementToken: string;
  expiresAt: string;
  durationDays: number;
  credentialHashes: string[];
};
export type PublicWalletShare = {
  expiresAt: string;
  credentials: { credentialHash: string }[];
};

export function parseShareToken(value: string, webUrl: string): string | undefined {
  try {
    const expected = new URL(webUrl);
    const parsed = new URL(value.trim());
    const match = parsed.pathname.match(/^\/share\/([A-Za-z0-9_-]{43})\/?$/);
    if (
      parsed.origin !== expected.origin ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      return undefined;
    return match?.[1];
  } catch {
    return undefined;
  }
}

export async function createWalletShare(
  apiUrl: string,
  credentialHashes: string[],
  durationDays: number,
): Promise<Omit<WalletShare, 'credentialHashes'>> {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/wallet/shares`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credentialHashes, durationDays }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message ?? 'The share service is unavailable.');
  return body;
}

export async function getPublicWalletShare(
  apiUrl: string,
  token: string,
): Promise<PublicWalletShare> {
  const response = await fetch(
    `${apiUrl.replace(/\/$/, '')}/wallet/shares/${encodeURIComponent(token)}`,
  );
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message ?? 'This share is unavailable.');
  return body;
}

export async function revokeWalletShare(apiUrl: string, share: WalletShare): Promise<void> {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/wallet/shares/${share.id}`, {
    method: 'DELETE',
    headers: { 'x-share-management-token': share.managementToken },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 410)
    throw new Error(body?.message ?? 'This share could not be turned off.');
}

export async function getIssuerProfile(apiUrl: string, address: string) {
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, '')}/organizations/by-issuer/${encodeURIComponent(address)}`,
    );
    if (!response.ok) return null;
    const body = await response.json();
    return body?.organization ?? null;
  } catch {
    return null;
  }
}
const states: VerificationState[] = [
  'valid',
  'not-found',
  'metadata-unavailable',
  'metadata-invalid',
  'ledger-unavailable',
  'malformed',
];
export const resultTitles: Record<VerificationResult['state'], string> = {
  valid: 'Credential verified',
  'not-found': 'Record not found',
  'metadata-unavailable': 'Credential details unavailable',
  'metadata-invalid': 'Proof does not match',
  'ledger-unavailable': 'Blockchain unavailable',
  malformed: 'Check the credential reference',
  'service-unavailable': 'Verification service unavailable',
};
export async function verifyCredential(apiUrl: string, hash: string): Promise<VerificationResult> {
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/credentials/${hash}/verify`, {
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (body?.error === 'LEDGER_UNAVAILABLE')
      return {
        state: 'ledger-unavailable',
        message: 'The blockchain is unavailable. Retry when the ledger is back online.',
      };
    if (body?.error === 'MALFORMED_REFERENCE')
      return {
        state: 'malformed',
        message: 'The service could not process this credential reference.',
      };
    if (!states.includes(body.state))
      return {
        state: 'service-unavailable',
        message:
          'The service returned an unexpected response. Check the API address in Settings and retry.',
      };
    if (body.state === 'valid') {
      if (!response.ok || !body.metadata) throw new Error('Incomplete verification response');
      return {
        state: 'valid',
        message:
          'Public record and credential details match. This does not prove the presenter controls the holder wallet.',
        metadata: parseMetadata(body.metadata),
      };
    }
    return {
      state: body.state,
      message:
        typeof body.message === 'string'
          ? body.message
          : resultTitles[body.state as VerificationState],
    };
  } catch {
    return {
      state: 'service-unavailable',
      message:
        'Could not reach the verification service. Check your connection and API address, then retry. The credential has not been marked invalid.',
    };
  }
}
export function readSavedCredentials(raw: string | null): SavedCredential[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Stored library is malformed');
  return data
    .filter((entry): entry is SavedCredential =>
      Boolean(
        entry &&
        typeof entry === 'object' &&
        typeof entry.hash === 'string' &&
        parseReference(entry.hash) &&
        typeof entry.name === 'string' &&
        typeof entry.savedAt === 'string',
      ),
    )
    .slice(0, 100)
    .map(({ hash, name, savedAt, metadata }) => {
      const normalizedMetadata = readCredentialMetadata(metadata);
      return {
        hash: parseReference(hash)!,
        name,
        savedAt,
        ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
      };
    });
}

function readCredentialMetadata(value: unknown): CredentialMetadata | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1
  )
    return undefined;
  try {
    return parseMetadata(value as CredentialMetadata);
  } catch {
    return undefined;
  }
}

function parseMetadata(value: CredentialMetadata): CredentialMetadata {
  if (value.schemaVersion !== 1) throw new Error('Unsupported metadata version');
  const payload = normalizePayload({ ...value, metadataUri: 'local://validation' });
  return {
    schemaVersion: 1,
    skillName: payload.skillName,
    skillLevel: payload.skillLevel,
    issueDate: payload.issueDate,
    issuerAddress: payload.issuerAddress,
    learnerAddress: payload.learnerAddress,
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    ...(typeof value.documentName === 'string' ? { documentName: value.documentName } : {}),
  };
}
