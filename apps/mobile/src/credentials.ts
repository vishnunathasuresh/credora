import { normalizePayload, type CredentialMetadata } from '@credora/credential-core';
import { parseCredentialReference, type VerificationState } from '@credora/shared';
export const parseReference = parseCredentialReference;

export type VerificationResult = {
  state: VerificationState | 'service-unavailable';
  message: string;
  metadata?: CredentialMetadata;
};
export type SavedCredential = { hash: string; name: string; savedAt: string };
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
    .map(({ hash, name, savedAt }) => ({ hash: parseReference(hash)!, name, savedAt }));
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
