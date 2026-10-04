'use client';
import { Button } from './ui/button';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowUpRightIcon } from './icons';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          Share QR
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {credentialName}</DialogTitle>
          <DialogDescription>
            Scan to check the public record. This link contains no private learner details.
          </DialogDescription>
        </DialogHeader>
        {qrDataUrl ? (
          <img
            className="credential-qr"
            width={280}
            height={280}
            src={qrDataUrl}
            alt={`Verification QR for ${credentialName}`}
          />
        ) : (
          <p role="status">{error ? 'QR unavailable' : 'Generating QR…'}</p>
        )}
        <code className="share-dialog-url">{verificationUrl}</code>
        <div className="share-dialog-actions">
          <Button onClick={shareLink}>Share link</Button>
          <Button variant="outline" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {qrDataUrl ? (
            <Button variant="outline" asChild>
              <a href={qrDataUrl} download={`credora-${credentialHash}.png`}>
                Download QR
              </a>
            </Button>
          ) : null}
          <Button variant="link" asChild>
            <a href={verificationUrl}>
              Open verifier <ArrowUpRightIcon />
            </a>
          </Button>
        </div>
        {error ? (
          <p className="form-help form-error" role="alert">
            {error}
          </p>
        ) : null}
        <span className="sr-only" role="status">
          {copied ? 'Link copied' : ''}
        </span>
      </DialogContent>
    </Dialog>
  );
}
