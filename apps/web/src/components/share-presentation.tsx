'use client';

import type { CredentialMetadata } from '@credora/credential-core';
import type { VerificationState } from '@credora/shared';
import { ReactQRCode } from '@lglab/react-qr-code';
import { useCallback, useEffect, useState } from 'react';
import { apiUrlFor } from '../lib/credora-api';
import { CredentialCard, type IssuerProfile } from './credential-card';
import { AlertIcon, CheckIcon } from './icons';
import { Button } from './ui/button';

type ShareData = { expiresAt: string; credentials: { credentialHash: string }[] };
type Verification = {
  state: VerificationState | 'service-unavailable';
  message?: string;
  metadata?: CredentialMetadata;
};
type VerifiedCredential = {
  hash: string;
  result: Verification;
  issuerProfile: IssuerProfile;
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrlFor(path), { cache: 'no-store', signal });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'The sharing service is unavailable.');
  return body as T;
}

async function getVerification(hash: string, signal?: AbortSignal): Promise<Verification> {
  try {
    const response = await fetch(apiUrlFor(`/credentials/${encodeURIComponent(hash)}/verify`), {
      cache: 'no-store',
      signal,
    });
    const body = (await response.json().catch(() => ({}))) as Verification & { error?: string };
    if (body.state) return body;
    return {
      state: body.error === 'LEDGER_UNAVAILABLE' ? 'ledger-unavailable' : 'service-unavailable',
      message: body.message ?? 'The verification service could not confirm this credential.',
    };
  } catch {
    return {
      state: 'service-unavailable',
      message:
        'Could not reach the verification service. The credential has not been marked invalid.',
    };
  }
}

export function SharePresentation({ token }: { token: string }) {
  const [credentials, setCredentials] = useState<VerifiedCredential[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setBusy(true);
      setError('');
      try {
        const share = await getJson<ShareData>(
          `/wallet/shares/${encodeURIComponent(token)}`,
          signal,
        );
        setExpiresAt(share.expiresAt);
        const verified = await Promise.all(
          share.credentials.map(async ({ credentialHash }) => {
            const result = await getVerification(credentialHash, signal);
            let issuerProfile: IssuerProfile = null;
            if (result.metadata) {
              try {
                const profile = await getJson<{ organization: IssuerProfile }>(
                  `/organizations/by-issuer/${encodeURIComponent(result.metadata.issuerAddress)}`,
                  signal,
                );
                issuerProfile = profile.organization;
              } catch {
                // Branding is optional; it never changes the proof result.
              }
            }
            return { hash: credentialHash, result, issuerProfile };
          }),
        );
        setCredentials(verified);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'This share cannot be opened.');
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  useEffect(() => {
    const controller = new AbortController();
    setShareUrl(window.location.href);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="page-width narrow-page share-presentation-page">
      <p className="panel-label">Credora wallet share</p>
      <h1>Selected credentials.</h1>
      <p className="lede">
        Each credential below is checked against its public registry record and metadata. This QR
        groups records for convenience; it does not prove who is presenting them.
      </p>
      {busy ? <p role="status">Loading and checking selected credentials…</p> : null}
      {error ? (
        <section className="share-state share-state-error" role="alert">
          <AlertIcon />
          <div>
            <strong>This share is unavailable.</strong>
            <p>{error}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </section>
      ) : null}
      {!busy && !error ? (
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
            result.state === 'valid' && result.metadata ? (
              <CredentialCard
                key={hash}
                metadata={result.metadata}
                credentialHash={hash}
                issuerProfile={issuerProfile}
              />
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
                {result.state === 'service-unavailable' ? (
                  <p>
                    The service is unavailable. Retry before drawing a conclusion about the proof.
                  </p>
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
