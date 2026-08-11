import { verificationMessage } from '@credora/credential-core';

export default async function CredentialVerificationPage({
  params,
}: {
  params: Promise<{ credentialRef: string }>;
}) {
  const { credentialRef } = await params;
  const isHash = /^0x[0-9a-fA-F]{64}$/.test(credentialRef);
  const message = isHash
    ? verificationMessage('ledger-unavailable')
    : 'This reference is not a valid credential hash.';
  return (
    <main className="page-width narrow-page">
      <p className="eyebrow">Credential result</p>
      <h1>{isHash ? 'Registry lookup pending.' : 'Reference not understood.'}</h1>
      <p className="lede">{message}</p>
      <div className="result-card">
        <span className="result-icon">{isHash ? '…' : '!'}</span>
        <div>
          <p className="result-label">Submitted reference</p>
          <code>{credentialRef}</code>
        </div>
      </div>
      <a className="text-link" href="/verify">
        Try another reference <span>↗</span>
      </a>
    </main>
  );
}
