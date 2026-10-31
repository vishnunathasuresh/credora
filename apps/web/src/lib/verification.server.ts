import { credentialReferenceFromHash } from '@credora/credential-core';
import type {
  CredentialMetadata,
  OrganizationCredentialMetadata,
  SelectiveCredentialMetadata,
} from '@credora/credential-core';
import type { VerificationState } from '@credora/shared';

export type VerificationResult = {
  state: VerificationState;
  credentialHash?: string;
  issuer?: string;
  learner?: string;
  metadataUri?: string;
  transactionHash?: string;
  blockNumber?: string;
  metadata?: CredentialMetadata | SelectiveCredentialMetadata | OrganizationCredentialMetadata;
  protocolVersion?: 1 | 2 | 3;
  message?: string;
  source?: 'api' | 'direct-rpc';
};

export function requiresDirectV3Verification(result: VerificationResult) {
  return result.protocolVersion === 3 || result.metadata?.schemaVersion === 3;
}

export function shouldLookupIssuerProfile(result: VerificationResult) {
  return result.state === 'valid' && !!result.metadata && !requiresDirectV3Verification(result);
}

export async function fetchIssuerProfile(address: string) {
  const apiUrl =
    process.env.VITE_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, '')}/organizations/by-issuer/${encodeURIComponent(address)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      organization?: { name: string; websiteUrl: string; logoUrl: string | null } | null;
    };
    return body.organization ?? null;
  } catch {
    return null;
  }
}

export async function fetchVerification(
  reference: string,
  verifyDirect?: (reference: string) => Promise<VerificationResult>,
): Promise<VerificationResult> {
  try {
    credentialReferenceFromHash(reference);
  } catch {
    return {
      state: 'malformed',
      source: 'direct-rpc',
      message: 'Credential reference must be a 32-byte hash.',
    };
  }

  try {
    if (verifyDirect) return await verifyDirect(reference);
    const { fetchDirectVerification } = await import('./direct-verification.server');
    return await fetchDirectVerification(reference);
  } catch {
    return {
      state: 'ledger-unavailable',
      source: 'direct-rpc',
      message: 'Unable to check the credential registries directly right now.',
    };
  }
}

export async function fetchRecipientProfile(
  reference: string,
): Promise<{ name: string; handle: string } | null> {
  const apiUrl =
    process.env.VITE_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, '')}/credentials/${encodeURIComponent(reference)}/recipient-profile`,
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { profile: { name: string; handle: string } | null };
    return body.profile;
  } catch {
    return null;
  }
}
