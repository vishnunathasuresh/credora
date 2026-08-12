export type Role = 'ADMIN' | 'ISSUER' | 'LEARNER' | 'VERIFIER';

export type OperationState =
  | 'draft'
  | 'metadata-uploaded'
  | 'transaction-pending'
  | 'confirmed'
  | 'metadata-upload-failed'
  | 'transaction-rejected'
  | 'transaction-reverted'
  | 'ledger-unavailable';

export type VerificationState =
  | 'valid'
  | 'not-found'
  | 'metadata-unavailable'
  | 'metadata-invalid'
  | 'ledger-unavailable'
  | 'malformed';

export class CredoraError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = 'CredoraError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
