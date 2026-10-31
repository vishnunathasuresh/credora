import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { verificationMessage } from '@credora/credential-core';
import { AlertIcon, ArrowUpRightIcon, CheckIcon, MinusIcon } from '../components/icons';
import { CredentialCard } from '../components/credential-card';
import { RetryVerification } from '../components/retry-verification';
import { loadCredentialVerification } from '../lib/verification.functions';
import type { VerificationResult } from '../lib/verification.server';

type CredentialVerificationData = {
  recipientProfile: { name: string; handle: string } | null;
  result: VerificationResult;
  issuerProfile: { name: string; websiteUrl: string; logoUrl: string | null } | null;
};

export const Route = createFileRoute('/verify_/$credentialRef')({
  loader: async ({ params }): Promise<CredentialVerificationData> => {
    return await loadCredentialVerification({ data: { credentialRef: params.credentialRef } });
  },
  pendingComponent: VerificationLoading,
  errorComponent: VerificationError,
  component: CredentialVerificationPage,
});

function VerificationLoading() {
  return (
    <main className="page-width narrow-page workspace-page" aria-busy="true">
      <header className="app-page-header">
        <div>
          <h1>Checking credential</h1>
          <p className="lede">Reading the registry and credential metadata.</p>
        </div>
      </header>
    </main>
  );
}

function VerificationError({ error, reset }: { error: unknown; reset: () => void }) {
  return (
    <main className="page-width narrow-page workspace-page">
      <header className="app-page-header">
        <div>
          <h1>Verification could not be completed</h1>
        </div>
      </header>
      <p className="lede">
        {error instanceof Error && error.message
          ? error.message
          : 'The verification service could not complete this request.'}
      </p>
      <button className="button button-dark" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

function CredentialVerificationPage() {
  const { credentialRef } = Route.useParams();
  const { result, issuerProfile, recipientProfile } = Route.useLoaderData();
  const message = result.message ?? verificationMessage(result.state);
  const metadata =
    result.state === 'valid' && result.metadata && result.metadata.schemaVersion !== 2
      ? result.metadata
      : undefined;
  const title =
    result.state === 'valid'
      ? result.protocolVersion === 3
        ? 'Credential proof matches.'
        : 'Credential proof matches.'
      : result.state === 'not-found'
        ? 'Credential not found.'
        : result.state === 'metadata-invalid'
          ? 'Proof mismatch.'
          : result.state === 'metadata-unavailable'
            ? 'Metadata unavailable.'
            : result.state === 'metadata-malformed'
              ? 'Metadata malformed.'
              : result.state === 'unsupported-version'
                ? 'Unsupported credential version.'
                : result.state === 'malformed'
                  ? 'Reference not understood.'
                  : 'Registry lookup unavailable.';
  const statusLabel =
    result.state === 'valid'
      ? result.protocolVersion === 3
        ? 'V3 proof fields match'
        : 'Proof fields match'
      : result.state === 'not-found'
        ? 'No matching record'
        : result.state === 'metadata-invalid'
          ? 'Proof mismatch'
          : result.state === 'metadata-unavailable'
            ? 'Metadata unavailable'
            : result.state === 'metadata-malformed'
              ? 'Metadata malformed'
              : result.state === 'unsupported-version'
                ? 'Unsupported version'
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
    <main className="page-width narrow-page workspace-page">
      <h1>{title}</h1>
      <p className="lede">{message}</p>
      <div className={`status-badge status-${statusTone}`} role="status">
        {statusIcon}
        <span>{statusLabel}</span>
      </div>
      {metadata ? (
        <CredentialCard
          metadata={metadata}
          credentialHash={credentialRef}
          issuerProfile={issuerProfile}
          recipientProfile={recipientProfile}
          showQr
          interactive
        />
      ) : (
        <div className={`result-card result-${statusTone}`} role="alert">
          <span className="result-icon">{statusIcon}</span>
          <div>
            <p className="result-label">Submitted reference</p>
            <code>{credentialRef}</code>
          </div>
        </div>
      )}
      {result.source === 'direct-rpc' ? (
        <p className="form-help verification-source">
          Proof checked directly against the configured registry. Metadata came from local API
          storage or the configured IPFS gateway.
        </p>
      ) : null}
      {result.state === 'valid' && result.protocolVersion === 3 ? (
        <section className="form-help verification-source" aria-label="Proof limits">
          <p>This v3 check establishes matching proof fields only. These remain unknown:</p>
          <ul>
            <li>Real-world issuer identity</li>
            <li>Control of the recipient wallet</li>
            <li>Whether the configured contract deployment was independently verified</li>
            <li>Issuer authorization at the historical issuance time</li>
            <li>Transaction finality</li>
          </ul>
          <p>
            The displayed issue date is a metadata claim; it is not the registry issuedAt timestamp.
          </p>
        </section>
      ) : null}
      {result.state === 'ledger-unavailable' || result.state === 'metadata-unavailable' ? (
        <div className="verification-actions">
          <RetryVerification />
          <span className="form-help">
            The proof may still be available when the source recovers.
          </span>
        </div>
      ) : null}
      <Link className="text-link" to="/verify">
        Try another reference <ArrowUpRightIcon />
      </Link>
    </main>
  );
}
