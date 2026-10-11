'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parseCredentialReference } from '@credora/shared';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

function routeForQrValue(value: string, origin: string) {
  const credentialHash = parseCredentialReference(value);
  if (credentialHash) return `/verify/${encodeURIComponent(credentialHash)}`;

  try {
    const url = new URL(value.trim(), origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    const share = url.pathname.match(/^\/share\/([A-Za-z0-9_-]{43})\/?$/);
    if (share) return `/share/${share[1]}`;
  } catch {
    return;
  }
}

export function VerifyForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reference, setReference] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Opening camera…');
  const [error, setError] = useState('');
  const parsedReference = parseCredentialReference(reference);
  const valid = Boolean(parsedReference);
  const referenceError =
    hasSubmitted && !valid ? 'Enter a valid Credora verification link or reference.' : null;

  const openQrValue = useCallback(
    (value: string) => {
      const route = routeForQrValue(value, window.location.origin);
      setCameraOpen(false);
      if (!route) {
        setError('That QR code is not a Credora credential or share code.');
        return;
      }
      setError('');
      router.push(route);
    },
    [router],
  );

  useEffect(() => {
    if (!cameraOpen) return;
    let stopped = false;
    let stopScanning: (() => void) | undefined;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is unavailable here. Upload a QR image instead.');
        setCameraOpen(false);
        return;
      }

      try {
        const preview = videoRef.current;
        if (!preview) return;
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(undefined, preview, (result) => {
          if (!result || stopped) return;
          stopped = true;
          openQrValue(result.getText());
        });
        stopScanning = () => controls.stop();
        if (stopped) stopScanning();
        else setCameraStatus('Point the camera at a Credora QR code.');
      } catch {
        if (stopped) return;
        setError('Could not open the camera. Check browser camera access or upload a QR image.');
        setCameraOpen(false);
      }
    }

    void startCamera();
    return () => {
      stopped = true;
      stopScanning?.();
    };
  }, [cameraOpen, openQrValue]);

  async function readQrImage(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a QR image smaller than 10 MB.');
      return;
    }
    setError('');
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const imageUrl = URL.createObjectURL(file);
      try {
        const result = await new BrowserQRCodeReader().decodeFromImageUrl(imageUrl);
        openQrValue(result.getText());
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch {
      setError('Could not read a QR code from that image. Try a clearer PNG, JPG, or WebP image.');
    }
  }

  return (
    <form
      className="verify-form"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        setHasSubmitted(true);
        if (!valid) {
          inputRef.current?.focus();
          return;
        }
        startTransition(() => router.push(`/verify/${encodeURIComponent(parsedReference!)}`));
      }}
    >
      <div className="verify-qr-actions">
        <Button
          className="button button-dark"
          type="button"
          onClick={() => {
            setError('');
            setCameraStatus('Opening camera…');
            setCameraOpen(true);
          }}
        >
          Scan a QR code
        </Button>
        <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
          Upload a QR image
        </Button>
        <input
          ref={fileInputRef}
          className="verify-qr-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Upload a QR code image"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            void readQrImage(file);
          }}
        />
      </div>

      {cameraOpen ? (
        <div className="verify-qr-camera">
          <video ref={videoRef} autoPlay muted playsInline aria-label="QR code camera preview" />
          <div className="verify-qr-camera-footer">
            <span role="status">{cameraStatus}</span>
            <Button variant="outline" type="button" onClick={() => setCameraOpen(false)}>
              Stop scanning
            </Button>
          </div>
        </div>
      ) : null}

      <p
        className={`verify-qr-message${error ? ' form-error' : ''}`}
        role={error ? 'alert' : 'status'}
      >
        {error || 'Scan a credential QR, or upload its image. The QR opens the public proof.'}
      </p>

      <details className="verify-reference-fallback">
        <summary>Or enter a verification link or reference</summary>
        <Label htmlFor="credential-reference">Verification link or reference</Label>
        <div className="form-row">
          <Input
            id="credential-reference"
            ref={inputRef}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Paste a Credora verification link"
            spellCheck={false}
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            maxLength={2048}
            aria-invalid={Boolean(referenceError)}
            aria-describedby="credential-reference-help"
          />
          <Button className="button button-dark" type="submit" disabled={isPending}>
            {isPending ? 'Checking…' : 'Verify'}
          </Button>
        </div>
        <div
          id="credential-reference-help"
          className={`form-help${referenceError ? ' form-error' : ''}`}
          aria-live="polite"
          role={referenceError ? 'alert' : undefined}
        >
          {referenceError ?? 'Direct links and existing credential references still work.'}
        </div>
      </details>
    </form>
  );
}
