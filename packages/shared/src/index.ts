export type Role = 'SUPERADMIN' | 'ORG_ADMIN' | 'ADMIN' | 'ISSUER' | 'LEARNER' | 'VERIFIER';

export type ProfileProject = {
  id: string;
  name: string;
  description: string;
  url: string;
};

export type ProfileExperience = {
  id: string;
  role: string;
  organization: string;
  period: string;
  description: string;
};

export type ProfileEducation = {
  id: string;
  school: string;
  degree: string;
  period: string;
  description: string;
};

export type RichProfileContent = {
  avatarUrl: string;
  projects: ProfileProject[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
};

export type ProfileCredentialSummary = {
  credentialHash: string;
  skillName: string;
  skillLevel: string;
  issueDate: string;
  organizationName: string | null;
};

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

/** Extract a public credential reference without navigating to a supplied URL. */
export function parseCredentialReference(value: string): string | undefined {
  const input = value.trim();
  if (/^0x[\da-fA-F]{64}$/.test(input)) return input.toLowerCase();
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const match = url.pathname.match(/^\/verify\/(0x[\da-fA-F]{64})\/?$/);
    return match?.[1].toLowerCase();
  } catch {
    return;
  }
}
