'use client';

import { ReactQRCode } from '@lglab/react-qr-code';
import type { CredentialMetadata } from '@credora/credential-core';
import { useEffect, useState } from 'react';
import { CheckIcon } from './icons';

export type IssuerProfile = {
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
} | null;

function shortenedAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function CredentialCard({
  metadata,
  credentialHash,
  issuerProfile,
  qrUrl,
  showQr = false,
  verified = true,
}: {
  metadata: CredentialMetadata;
  credentialHash: string;
  issuerProfile: IssuerProfile;
  qrUrl?: string;
  showQr?: boolean;
  verified?: boolean;
}) {
  const [verificationUrl, setVerificationUrl] = useState('');
  useEffect(() => {
    if (qrUrl) setVerificationUrl(qrUrl);
    else if (showQr) setVerificationUrl(`${window.location.origin}/verify/${credentialHash}`);
    else setVerificationUrl('');
  }, [credentialHash, qrUrl, showQr]);

  return (
    <article className="credential-card">
      <header className="credential-card-header">
        <div className="credential-card-issuer">
          {issuerProfile?.logoUrl ? (
            <img
              className="credential-card-logo"
              src={issuerProfile.logoUrl}
              alt={`${issuerProfile.name} logo`}
              referrerPolicy="no-referrer"
              onError={(event) => (event.currentTarget.hidden = true)}
            />
          ) : (
            <span className="credential-card-monogram" aria-hidden="true">
              {issuerProfile?.name.slice(0, 1).toUpperCase() ?? 'C'}
            </span>
          )}
          <span>
            <strong>{issuerProfile?.name ?? 'Credential issuer'}</strong>
            <small>Issued by {shortenedAddress(metadata.issuerAddress)}</small>
          </span>
        </div>
        <span
          className={`credential-card-proof ${verified ? '' : 'credential-card-proof-pending'}`}
        >
          {verified ? <CheckIcon /> : <span aria-hidden="true">•</span>}
          {verified ? 'Public proof matches' : 'Issuer projection · check record'}
        </span>
      </header>
      <div className="credential-card-body">
        <p className="panel-label">Credential</p>
        <h2>{metadata.skillName}</h2>
        {metadata.description ? (
          <p className="credential-card-description">{metadata.description}</p>
        ) : null}
        <dl className="credential-card-details">
          <div>
            <dt>Level</dt>
            <dd>{metadata.skillLevel}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{new Date(metadata.issueDate).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt>Holder address</dt>
            <dd>{shortenedAddress(metadata.learnerAddress)}</dd>
          </div>
        </dl>
      </div>
      {verificationUrl ? (
        <footer className="credential-card-footer">
          <div className="credential-card-qr">
            <ReactQRCode
              value={verificationUrl}
              size={128}
              marginSize={2}
              level="Q"
              background="#ffffff"
              dataModulesSettings={{ color: '#111827', style: 'rounded' }}
              svgProps={{ role: 'img', 'aria-label': 'Credential verification QR code' }}
            />
          </div>
          <span>
            <strong>Scan to verify</strong>
            <small>This code opens the public verification record.</small>
          </span>
          <details className="credential-card-hash">
            <summary>Technical details</summary>
            <code>{credentialHash}</code>
            <small>The credential hash is checked during verification.</small>
          </details>
        </footer>
      ) : null}
    </article>
  );
}
