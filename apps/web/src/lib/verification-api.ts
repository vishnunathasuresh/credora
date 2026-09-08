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

export async function fetchVerification(reference: string): Promise<VerificationResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, '')}/credentials/${encodeURIComponent(reference)}/verify`,
      { cache: 'no-store' },
    );
    const body = (await response.json()) as Partial<VerificationResult> & { error?: string };
    if (body.state && response.ok) return { ...(body as VerificationResult), source: 'api' };
    if (response.status !== 503)
      return {
        state: body.state ?? 'malformed',
        source: 'api',
        message: body.message ?? body.error,
      };
    const { fetchDirectVerification } = await import('./direct-verification');
    const direct = await fetchDirectVerification(reference);
    if (direct.state === 'ledger-unavailable' && body.state)
      return { ...(body as VerificationResult), source: 'api' };
    return direct;
  } catch {
    try {
      const { fetchDirectVerification } = await import('./direct-verification');
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
