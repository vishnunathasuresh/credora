import { verificationMessage } from '@credora/credential-core';
import { fetchVerification } from '../../../lib/verification-api';
import { AlertIcon, ArrowUpRightIcon, CheckIcon, MinusIcon } from '../../../components/icons';
import { RetryVerification } from '../../../components/retry-verification';

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
  const statusLabel =
    result.state === 'valid'
      ? 'Verified on chain'
      : result.state === 'not-found'
        ? 'No matching record'
        : result.state === 'metadata-invalid'
          ? 'Proof mismatch'
          : result.state === 'metadata-unavailable'
            ? 'Metadata unavailable'
            : result.state === 'ledger-unavailable'
              ? 'Ledger unavailable'
              : 'Reference needs attention';
  const statusTone =
    result.state === 'valid' ? 'success' : result.state === 'not-found' ? 'neutral' : 'warning';
  const statusIcon =
    result.state === 'valid' ? (
      <CheckIcon />
    ) : result.state === 'not-found' ? (
      <MinusIcon />
    ) : (
      <AlertIcon />
    );
  return (
    <main className="page-width narrow-page">
      <h1>{title}</h1>
      <p className="lede">{message}</p>
      <div className={`status-badge status-${statusTone}`} role="status">
        {statusIcon}
        <span>{statusLabel}</span>
      </div>
      <div
        className={`result-card result-${statusTone}`}
        role={result.state === 'valid' ? 'status' : 'alert'}
      >
        <span className="result-icon">{statusIcon}</span>
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
      {result.source === 'direct-rpc' ? (
        <p className="form-help verification-source">
          Checked directly against the registry and public metadata source.
        </p>
      ) : null}
      {result.state === 'ledger-unavailable' || result.state === 'metadata-unavailable' ? (
        <div className="verification-actions">
          <RetryVerification />
          <span className="form-help">
            The proof may still be available when the source recovers.
          </span>
        </div>
      ) : null}
      <a className="text-link" href="/verify">
        Try another reference <ArrowUpRightIcon />
      </a>
    </main>
  );
}
