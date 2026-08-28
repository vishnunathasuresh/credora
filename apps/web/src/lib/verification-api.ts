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
};

export async function fetchVerification(reference: string): Promise<VerificationResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, '')}/credentials/${encodeURIComponent(reference)}/verify`,
      { cache: 'no-store' },
    );
    const body = (await response.json()) as Partial<VerificationResult> & { error?: string };
    if (body.state) return body as VerificationResult;
    return {
      state: response.status === 503 ? 'ledger-unavailable' : 'malformed',
      message: body.message ?? body.error,
    };
  } catch {
    return {
      state: 'ledger-unavailable',
      message: 'Unable to reach the verification service right now.',
    };
  }
}
