'use client';

import { ReactQRCode, type ReactQRCodeRef } from '@lglab/react-qr-code';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { apiUrlFor } from '../lib/credora-api';

type ShareCredential = {
  credential_hash: string;
  skill_name: string;
  skill_level: string;
  issue_date: string;
  issuer: string;
};

type ActiveShare = {
  id: string;
  token: string;
  managementToken: string;
  expiresAt: string;
  durationDays: number;
  credentialHashes: string[];
};

const storageKey = 'credora.wallet-share.v1';

async function shareRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrlFor(path), {
    cache: 'no-store',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'The share service is unavailable.');
  return body as T;
}

function readStoredShare(): ActiveShare | undefined {
  try {
    const value = localStorage.getItem(storageKey);
    if (!value) return undefined;
    const parsed = JSON.parse(value) as ActiveShare;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.token === 'string' &&
      typeof parsed.managementToken === 'string' &&
      Date.parse(parsed.expiresAt) > Date.now() &&
      Array.isArray(parsed.credentialHashes)
    )
      return parsed;
    localStorage.removeItem(storageKey);
  } catch {
    localStorage.removeItem(storageKey);
  }
  return undefined;
}

export function WalletShare({ credentials }: { credentials: ShareCredential[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [durationDays, setDurationDays] = useState(7);
  const [activeShare, setActiveShare] = useState<ActiveShare>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState('');
  const qrRef = useRef<ReactQRCodeRef>(null);
  const shareUrl = useMemo(
    () => (activeShare && currentOrigin ? `${currentOrigin}/share/${activeShare.token}` : ''),
    [activeShare, currentOrigin],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const currentSetMatches =
    activeShare &&
    selected.length === activeShare.credentialHashes.length &&
    activeShare.credentialHashes.every((hash) => selectedSet.has(hash));

  useEffect(() => {
    setCurrentOrigin(window.location.origin);
    setActiveShare(readStoredShare());
  }, []);

  function toggle(hash: string) {
    setSelected((current) =>
      current.includes(hash) ? current.filter((item) => item !== hash) : [...current, hash],
    );
  }

  async function turnOffShare(share = activeShare) {
    if (!share) return;
    setBusy(true);
    setError('');
    try {
      await shareRequest(`/wallet/shares/${encodeURIComponent(share.id)}`, {
        method: 'DELETE',
        headers: { 'x-share-management-token': share.managementToken },
      });
      localStorage.removeItem(storageKey);
      setActiveShare(undefined);
      setNotice('This QR has been turned off. Saved or photographed copies cannot be recalled.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not turn off this QR.';
      if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('already')) {
        localStorage.removeItem(storageKey);
        setActiveShare(undefined);
        setNotice('This QR is already inactive.');
      } else setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function createShare() {
    if (!selected.length || selected.length > 25 || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (activeShare)
        await shareRequest(`/wallet/shares/${encodeURIComponent(activeShare.id)}`, {
          method: 'DELETE',
          headers: { 'x-share-management-token': activeShare.managementToken },
        });
      const created = await shareRequest<Omit<ActiveShare, 'credentialHashes'>>('/wallet/shares', {
        method: 'POST',
        body: JSON.stringify({ credentialHashes: selected, durationDays }),
      });
      const next: ActiveShare = { ...created, credentialHashes: [...selected] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setActiveShare(next);
      setNotice('Previous QR turned off. This QR shares only the selected credentials.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a share QR.');
    } finally {
      setBusy(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice('Share link copied. It opens the same selected credentials as this QR.');
    } catch {
      setError('Could not copy the link. Scan the QR code instead.');
    }
  }

  return (
    <section className="wallet-share-panel" aria-labelledby="wallet-share-title">
      <div className="wallet-share-heading">
        <div>
          <p className="panel-label">One QR · selected credentials</p>
          <h2 id="wallet-share-title">Choose what to share.</h2>
          <p>
            Make one QR for this selection. Anyone who scans it can see these public credential
            records until it expires or you turn it off.
          </p>
        </div>
        <span className="wallet-share-count" aria-live="polite">
          {selected.length} selected
        </span>
      </div>
      <div className="wallet-share-options">
        {credentials.map((credential) => {
          const checked = selectedSet.has(credential.credential_hash);
          const id = `share-${credential.credential_hash}`;
          return (
            <div className="wallet-share-option" key={credential.credential_hash}>
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={() => toggle(credential.credential_hash)}
              />
              <Label htmlFor={id} className="wallet-share-option-copy">
                <strong>{credential.skill_name}</strong>
                <span>
                  {credential.skill_level} · {new Date(credential.issue_date).toLocaleDateString()}
                </span>
              </Label>
              <code>{credential.credential_hash.slice(0, 10)}…</code>
            </div>
          );
        })}
      </div>
      {selected.length > 25 ? (
        <p className="form-help form-error" role="alert">
          Share up to 25 credentials at a time so the results stay quick and easy to scan.
        </p>
      ) : null}
      <div className="wallet-share-controls">
        <div className="wallet-share-duration">
          <Label htmlFor="wallet-share-duration" className="wallet-share-duration-label">
            QR expires after
          </Label>
          <NativeSelect
            id="wallet-share-duration"
            value={durationDays}
            onChange={(event) => setDurationDays(Number(event.target.value))}
            aria-label="Share QR expiration duration"
          >
            <NativeSelectOption value={1}>1 day</NativeSelectOption>
            <NativeSelectOption value={7}>7 days</NativeSelectOption>
            <NativeSelectOption value={30}>30 days</NativeSelectOption>
          </NativeSelect>
        </div>
        <Button
          type="button"
          onClick={createShare}
          disabled={!selected.length || selected.length > 25 || busy}
        >
          {busy ? 'Preparing QR…' : activeShare ? 'Replace share QR' : 'Create share QR'}
        </Button>
      </div>
      {activeShare && shareUrl ? (
        <div className="wallet-share-active">
          <div className="wallet-share-qr">
            <ReactQRCode
              ref={qrRef}
              value={shareUrl}
              size={240}
              marginSize={4}
              level="H"
              background="#ffffff"
              dataModulesSettings={{ color: '#111827', style: 'rounded' }}
              finderPatternOuterSettings={{ color: '#111827', style: 'rounded-sm' }}
              finderPatternInnerSettings={{ color: '#111827', style: 'rounded-sm' }}
              svgProps={{ role: 'img', 'aria-label': 'QR code for selected public credentials' }}
            />
          </div>
          <div className="wallet-share-active-copy">
            <strong>Your share QR is ready.</strong>
            <span>
              {activeShare.credentialHashes.length} credential
              {activeShare.credentialHashes.length === 1 ? '' : 's'} · expires{' '}
              {new Date(activeShare.expiresAt).toLocaleString()}
            </span>
            <p>
              The share code groups public proofs; it does not prove who is holding the phone.
              Turning it off stops future scans. Copies already viewed or saved cannot be recalled.
            </p>
            <code className="wallet-share-url">{shareUrl}</code>
            <div className="wallet-share-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  qrRef.current?.download({
                    name: 'credora-wallet-share',
                    format: 'png',
                    size: 720,
                  })
                }
              >
                Download QR
              </Button>
              <Button type="button" variant="outline" onClick={copyShareUrl}>
                Copy link
              </Button>
              <Button type="button" variant="destructive" onClick={() => void turnOffShare()}>
                Turn off QR
              </Button>
            </div>
            {currentSetMatches === false ? (
              <span className="form-help">
                Your selection changed. Replacing this QR will turn off the old selection first.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <p className="wallet-share-footnote">
        Selecting fewer records here only changes this QR. Individual public verification links
        remain valid and can be shared separately.
      </p>
      {notice ? (
        <p className="form-help" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="form-help form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
