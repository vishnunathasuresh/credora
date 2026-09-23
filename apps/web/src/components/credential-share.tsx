'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowUpRightIcon, CloseIcon } from './icons';

type CredentialShareProps = {
  credentialHash: string;
  credentialName: string;
};

function shareUrl(hash: string) {
  if (typeof window === 'undefined') return `/verify/${hash}`;
  return `${window.location.origin}/verify/${hash}`;
}

export function CredentialShare({ credentialHash, credentialName }: CredentialShareProps) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const verificationUrl = useMemo(() => shareUrl(credentialHash), [credentialHash]);
  const dialogTitleId = `share-title-${credentialHash.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    if (!open) return;
    setQrDataUrl('');
    setError('');
    void QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setError('The QR code could not be generated. Copy the link instead.'));
  }, [open, verificationUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('The link could not be copied. Use the public verification link below.');
    }
  }

  async function shareLink() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${credentialName} · Credora`,
        text: 'Verify this public Credora credential.',
        url: verificationUrl,
      });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError('The link could not be shared. Copy the link or scan the QR code instead.');
    }
  }

  return (
    <>
      <button
        className="text-button"
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Share QR
      </button>
      {open ? (
        <div
          className="share-dialog-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <div className="share-dialog-header">
              <div>
                <p className="panel-label">Public verification</p>
                <h2 id={dialogTitleId}>Share {credentialName}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close sharing dialog"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="share-dialog-content">
              {qrDataUrl ? (
                <img
                  className="credential-qr"
                  src={qrDataUrl}
                  alt={`QR code for the public verification link for ${credentialName}`}
                />
              ) : (
                <div className="credential-qr credential-qr-loading" aria-live="polite">
                  {error ? 'QR unavailable' : 'Generating QR…'}
                </div>
              )}
              <p className="share-dialog-note">
                Scan this code to open the public verifier. It contains only the verification link,
                not private learner details.
              </p>
              <code className="share-dialog-url">{verificationUrl}</code>
              <div className="share-dialog-actions">
                <button className="button button-dark" type="button" onClick={shareLink}>
                  Share link
                </button>
                <button className="button button-outline" type="button" onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a className="text-link" href={verificationUrl} onClick={() => setOpen(false)}>
                  Open verifier <ArrowUpRightIcon />
                </a>
              </div>
              {error ? (
                <p className="form-help form-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
