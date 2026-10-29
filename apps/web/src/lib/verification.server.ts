import type { CredentialMetadata } from '@credora/credential-core';
import type { VerificationState } from '@credora/shared';

export type VerificationResult = {
  state: VerificationState;
  credentialHash?: string;
  issuer?: string;
  learner?: string;
  metadataUri?: string;
  transactionHash?: string;
  blockNumber?: string;
  metadata?: CredentialMetadata;
  message?: string;
  source?: 'api' | 'direct-rpc';
};

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

export async function fetchVerification(reference: string): Promise<VerificationResult> {
  const apiUrl =
    process.env.VITE_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, '')}/credentials/${encodeURIComponent(reference)}/verify`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    const body = (await response.json()) as Partial<VerificationResult> & { error?: string };
    if (body.state && response.ok) return { ...(body as VerificationResult), source: 'api' };
    if (response.status !== 503)
      return {
        state: body.state ?? 'malformed',
        source: 'api',
        message: body.message ?? body.error,
      };
    const { fetchDirectVerification } = await import('./direct-verification.server');
    const direct = await fetchDirectVerification(reference);
    if (direct.state === 'ledger-unavailable' && body.state)
      return { ...(body as VerificationResult), source: 'api' };
    return direct;
  } catch {
    try {
      const { fetchDirectVerification } = await import('./direct-verification.server');
      return await fetchDirectVerification(reference);
    } catch {
      return {
        state: 'ledger-unavailable',
        source: 'api',
        message: 'Unable to reach the verification service right now.',
      };
    }
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
