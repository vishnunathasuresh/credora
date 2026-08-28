import { verificationMessage } from '@credora/credential-core';
import { fetchVerification } from '../../../lib/verification-api';

export const dynamic = 'force-dynamic';

export default async function CredentialVerificationPage({
  params,
}: {
  params: Promise<{ credentialRef: string }>;
}) {
  const { credentialRef } = await params;
  const isHash = /^0x[0-9a-fA-F]{64}$/.test(credentialRef);
  const result = isHash
    ? await fetchVerification(credentialRef)
    : { state: 'malformed' as const, message: 'This reference is not a valid credential hash.' };
  const message = result.message ?? verificationMessage(result.state);
  const metadata = result.state === 'valid' ? result.metadata : undefined;
  const title =
    result.state === 'valid'
      ? 'Credential verified.'
      : result.state === 'not-found'
        ? 'Credential not found.'
        : result.state === 'metadata-invalid'
          ? 'Proof mismatch.'
          : result.state === 'metadata-unavailable'
            ? 'Metadata unavailable.'
            : result.state === 'malformed'
              ? 'Reference not understood.'
              : 'Registry lookup unavailable.';
  return (
    <main className="page-width narrow-page">
      <p className="eyebrow">Credential result</p>
      <h1>{title}</h1>
      <p className="lede">{message}</p>
      <div className="result-card">
        <span className="result-icon">
          {metadata ? '✓' : result.state === 'not-found' ? '—' : '!'}
        </span>
        <div>
          <p className="result-label">Submitted reference</p>
          <code>{credentialRef}</code>
        </div>
      </div>
      {metadata ? (
        <div className="verification-note">
          <strong>{metadata.skillName}</strong>
          <span>
            {metadata.skillLevel} · issued {metadata.issueDate}
          </span>
          <span>Issuer: {metadata.issuerAddress}</span>
          <span>Learner: {metadata.learnerAddress}</span>
        </div>
      ) : null}
      <a className="text-link" href="/verify">
        Try another reference <span>↗</span>
      </a>
    </main>
  );
}
