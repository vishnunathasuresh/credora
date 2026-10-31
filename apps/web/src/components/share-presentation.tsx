'use client';

import { ReactQRCode } from '@lglab/react-qr-code';
import { useEffect, useState } from 'react';
import { CredentialCard } from './credential-card';
import { AlertIcon, CheckIcon } from './icons';
import { Button } from './ui/button';
import type { ShareVerificationData } from '../lib/share-verification.functions';

type VerifiedCredential = ShareVerificationData['credentials'][number];

export function SharePresentation({ data }: { data: ShareVerificationData }) {
  const [credentials] = useState<VerifiedCredential[]>(data.credentials);
  const { expiresAt, error = '', errorCode = '' } = data;
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  return (
    <main className="page-width narrow-page workspace-page share-presentation-page">
      <header className="app-page-header">
        <div>
          <h1>Shared credentials</h1>
          <p className="lede">
            Each credential below is checked directly against its pinned registry record and its
            metadata. This QR groups records for convenience; it does not prove who is presenting
            them.
          </p>
          <p className="form-help">
            Descriptions, images, and linked presentation content are not independently assessed.
            Proof checks establish only that the fields described in each status match the
            configured registry and metadata source.
          </p>
        </div>
      </header>
      {error ? (
        <section className="share-state share-state-error" role="alert">
          <AlertIcon />
          <div>
            <strong>
              {errorCode === 'SHARE_EXPIRED'
                ? 'This QR has expired or was turned off.'
                : errorCode === 'SHARE_NOT_FOUND'
                  ? 'This share link could not be found.'
                  : 'We could not load this share.'}
            </strong>
            <p>
              {errorCode === 'SHARE_EXPIRED'
                ? 'Ask the holder for a new QR. Individual credential records may still be checked using their own links.'
                : errorCode === 'SHARE_NOT_FOUND'
                  ? 'Check the QR or link, or ask the holder to create a new share.'
                  : `${error} Retry when the sharing service is available.`}
            </p>
          </div>
          {errorCode !== 'SHARE_EXPIRED' && errorCode !== 'SHARE_NOT_FOUND' ? (
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          ) : null}
        </section>
      ) : null}
      {!error ? (
        <>
          <section className="wallet-share-public-code">
            {shareUrl ? (
              <div className="wallet-share-qr">
                <ReactQRCode
                  value={shareUrl}
                  size={168}
                  marginSize={3}
                  level="H"
                  background="#ffffff"
                  dataModulesSettings={{ color: '#111827', style: 'rounded' }}
                  finderPatternOuterSettings={{ color: '#111827', style: 'rounded-sm' }}
                  finderPatternInnerSettings={{ color: '#111827', style: 'rounded-sm' }}
                  svgProps={{ role: 'img', 'aria-label': 'QR code for this credential selection' }}
                />
              </div>
            ) : null}
            <div>
              <strong>
                {credentials.length} selected credential{credentials.length === 1 ? '' : 's'}
              </strong>
              <span>Share expires {new Date(expiresAt).toLocaleString()}</span>
              <p>The code contains a random share reference, not wallet or credential details.</p>
            </div>
          </section>
          {credentials.map(({ hash, result, issuerProfile }) =>
            result.state === 'valid' && result.metadata && result.metadata.schemaVersion !== 2 ? (
              <div key={hash}>
                <CredentialCard
                  metadata={result.metadata}
                  credentialHash={hash}
                  issuerProfile={issuerProfile}
                />
                {result.message ? <p className="form-help">{result.message}</p> : null}
              </div>
            ) : (
              <section className="share-credential-state" key={hash}>
                <span
                  className={`status-badge status-${result.state === 'not-found' ? 'neutral' : 'warning'}`}
                >
                  {result.state === 'not-found' ? <AlertIcon /> : <AlertIcon />}
                  {result.state === 'not-found'
                    ? 'Record not found'
                    : result.state.replaceAll('-', ' ')}
                </span>
                <strong>{hash.slice(0, 12)}…</strong>
                <p>{result.message ?? 'This record could not be verified right now.'}</p>
                {result.state === 'ledger-unavailable' ||
                result.state === 'metadata-unavailable' ? (
                  <p>This may be a temporary outage; it is not a proof failure.</p>
                ) : null}
              </section>
            ),
          )}
          {credentials.some(({ result }) => result.state === 'valid') ? (
            <p className="share-verification-note">
              <CheckIcon /> Verified records are independent of this sharing link.
            </p>
          ) : null}
          <p className="wallet-share-footnote">
            Turning off or expiring a share prevents future visits to this page. Anyone who already
            saw or saved a public credential can still check its individual record.
          </p>
        </>
      ) : null}
    </main>
  );
}
