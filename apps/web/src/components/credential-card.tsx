'use client';

import { ReactQRCode } from '@lglab/react-qr-code';
import type { CredentialMetadata, OrganizationCredentialMetadata } from '@credora/credential-core';
import { useEffect, useState } from 'react';
import { CheckIcon } from './icons';
import { apiUrlFor } from '../lib/credora-api';
import { LanyardPreview } from './credential-lanyard';

function credentialImageUrl(uri: string | undefined) {
  const match = uri?.match(/^(?:ipfs|local):\/\/([A-Za-z0-9_-]{8,128})$/);
  return match ? apiUrlFor(`/assets/${encodeURIComponent(match[1])}`) : '';
}
export type IssuerProfile = { name: string; websiteUrl: string; logoUrl: string | null } | null;
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
  interactive = false,
  recipientProfile = null,
}: {
  metadata: CredentialMetadata | OrganizationCredentialMetadata;
  credentialHash: string;
  issuerProfile: IssuerProfile;
  qrUrl?: string;
  showQr?: boolean;
  verified?: boolean;
  interactive?: boolean;
  recipientProfile?: { name: string; handle: string } | null;
}) {
  const [verificationUrl, setVerificationUrl] = useState('');
  const imageUrl = credentialImageUrl(metadata.imageUri);
  const issuerName = issuerProfile?.name ?? 'Credential issuer';
  useEffect(() => {
    if (qrUrl) setVerificationUrl(qrUrl);
    else if (showQr) setVerificationUrl(`${window.location.origin}/verify/${credentialHash}`);
    else setVerificationUrl('');
  }, [credentialHash, qrUrl, showQr]);

  const front = (
    <article
      className={`credential-card${verified ? ' credential-card-verified' : ' credential-card-pending'}`}
    >
      <header className="credential-card-header">
        <div className="credential-card-issuer">
          {issuerProfile?.logoUrl ? (
            <img
              className="credential-card-logo"
              src={issuerProfile.logoUrl}
              alt={`${issuerName} logo`}
              referrerPolicy="no-referrer"
              onError={(event) => (event.currentTarget.hidden = true)}
            />
          ) : (
            <span className="credential-card-monogram" aria-hidden="true">
              {issuerName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>
            <strong>{issuerName}</strong>
            <small>Issuer</small>
          </span>
        </div>
        <span
          className={`credential-card-proof ${verified ? '' : 'credential-card-proof-pending'}`}
        >
          {verified ? (
            <CheckIcon size={16} />
          ) : (
            <span className="credential-proof-dot" aria-hidden="true" />
          )}
          {verified ? 'Proof matches' : 'Proof not checked'}
        </span>
      </header>
      {imageUrl ? (
        <div className="credential-card-art-wrap">
          <img
            className="credential-card-art"
            src={imageUrl}
            alt={`${metadata.skillName} attachment`}
            loading="lazy"
            onError={(event) => (event.currentTarget.hidden = true)}
          />
        </div>
      ) : null}
      <div className="credential-card-body">
        <h2>{metadata.skillName}</h2>
        <p className="credential-card-level">{metadata.skillLevel}</p>
        {metadata.description ? (
          <p className="credential-card-description">{metadata.description}</p>
        ) : null}
        <dl className="credential-card-details">
          <div>
            <dt>Issued</dt>
            <dd className="credential-issue-date">
              {new Date(metadata.issueDate).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt>Recipient</dt>
            <dd>
              {recipientProfile ? (
                <>
                  <span>{recipientProfile.name}</span>{' '}
                  <span className="credential-recipient-handle">@{recipientProfile.handle}</span>
                </>
              ) : (
                <span className="credential-wallet-address">
                  {shortenedAddress(metadata.learnerAddress)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
  const back = (
    <article className="credential-card credential-card-reverse">
      <div className="credential-card-back-title">
        <strong>{metadata.skillName}</strong>
      </div>
      {metadata.description ? (
        <p className="credential-card-description">{metadata.description}</p>
      ) : null}
      <dl className="credential-card-details credential-card-back-details">
        <div>
          <dt>Level</dt>
          <dd>{metadata.skillLevel}</dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd>
            {recipientProfile ? (
              <>
                <span>{recipientProfile.name}</span>{' '}
                <span className="credential-recipient-handle">@{recipientProfile.handle}</span>
              </>
            ) : (
              <span className="credential-wallet-address">
                {shortenedAddress(metadata.learnerAddress)}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd className="credential-issue-date">
            {new Date(metadata.issueDate).toLocaleDateString()}
          </dd>
        </div>
        <div>
          <dt>Issuer wallet</dt>
          <dd className="credential-wallet-address">{shortenedAddress(metadata.issuerAddress)}</dd>
        </div>
      </dl>
      {verificationUrl ? (
        <div className="credential-card-qr">
          <ReactQRCode
            value={verificationUrl}
            size={112}
            marginSize={2}
            level="Q"
            background="#fff"
            dataModulesSettings={{ color: '#17253e', style: 'rounded' }}
            svgProps={{ role: 'img', 'aria-label': 'Credential verification QR code' }}
          />
          <span>Scan to open verification</span>
        </div>
      ) : null}
      <details className="credential-card-hash">
        <summary>Full proof details</summary>
        <code>{credentialHash}</code>
        <small>The credential hash is checked during verification.</small>
      </details>
    </article>
  );

  if (interactive && showQr && verified) {
    return (
      <LanyardPreview
        title={metadata.skillName}
        issuerName={issuerName}
        issuerLogoUrl={issuerProfile?.logoUrl}
        issueDate={metadata.issueDate}
        recipientName={recipientProfile?.name ?? shortenedAddress(metadata.learnerAddress)}
        recipientHandle={recipientProfile?.handle}
        description={metadata.description}
        level={metadata.skillLevel}
        credentialHash={credentialHash}
        qrUrl={verificationUrl}
      />
    );
  }
  return (
    <>
      {front}
      {showQr && verificationUrl ? (
        <footer className="credential-card-footer">
          <div className="credential-card-qr">
            <ReactQRCode
              value={verificationUrl}
              size={96}
              marginSize={2}
              level="Q"
              background="#fff"
              dataModulesSettings={{ color: '#17253e', style: 'rounded' }}
              svgProps={{ role: 'img', 'aria-label': 'Credential verification QR code' }}
            />
          </div>
          <span>
            <strong>Scan to verify</strong>
            <small>This code opens the public verification record.</small>
          </span>
          <details className="credential-card-hash">
            <summary>Full proof details</summary>
            <code>{credentialHash}</code>
          </details>
        </footer>
      ) : null}
    </>
  );
}
