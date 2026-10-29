import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

type Feedback = { tone: 'status' | 'error'; message: string };
type QrState = { url: string; dataUrl?: string; error?: string };

function isAbortError(cause: unknown) {
  return cause instanceof DOMException && cause.name === 'AbortError';
}

function canonicalProfileUrl(handle: string) {
  return `${window.location.origin}/u/${encodeURIComponent(handle)}`;
}

async function copyWithFallback(url: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = url;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  }
}

export function ProfileShare({ handle, name }: { handle: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProfileUrl(canonicalProfileUrl(handle));
    setFeedback(null);
    setQr(null);
    setCopying(false);
    setSharing(false);
  }, [handle, open]);

  useEffect(() => {
    if (!open || !profileUrl || profileUrl !== canonicalProfileUrl(handle)) return;
    let active = true;
    setQr({ url: profileUrl });
    void import('qrcode')
      .then(({ toDataURL }) => toDataURL(profileUrl, { width: 256, margin: 2 }))
      .then((dataUrl) => {
        if (active) setQr({ url: profileUrl, dataUrl });
      })
      .catch(() => {
        if (active) {
          setQr({
            url: profileUrl,
            error: 'Could not generate a QR code. You can still copy the link.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [handle, open, profileUrl]);

  async function copyLink() {
    const url = canonicalProfileUrl(handle);
    setCopying(true);
    setFeedback(null);
    try {
      if (await copyWithFallback(url)) {
        setFeedback({ tone: 'status', message: 'Profile link copied.' });
      } else {
        setProfileUrl(url);
        setFeedback({
          tone: 'error',
          message: 'Could not copy the link. Select it below and copy it manually.',
        });
      }
    } catch {
      setProfileUrl(url);
      setFeedback({
        tone: 'error',
        message: 'Could not copy the link. Select it below and copy it manually.',
      });
    } finally {
      setCopying(false);
    }
  }

  async function shareLink() {
    const url = canonicalProfileUrl(handle);
    setSharing(true);
    setFeedback(null);
    if (!navigator.share) {
      setFeedback({
        tone: 'status',
        message: 'Sharing is unavailable in this browser. Copy the link instead.',
      });
      setSharing(false);
      return;
    }
    try {
      await navigator.share({ title: `${name} on Credora`, text: `@${handle}`, url });
      setFeedback({ tone: 'status', message: 'Profile shared.' });
    } catch (cause) {
      setFeedback({
        tone: isAbortError(cause) ? 'status' : 'error',
        message: isAbortError(cause)
          ? 'Sharing canceled. The link is ready to copy.'
          : 'Sharing could not be completed. Copy the link instead.',
      });
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="profile-share-actions">
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Share profile
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share profile</DialogTitle>
            <DialogDescription>
              {name} · @{handle}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Label htmlFor="profile-share-url">Public profile link</Label>
            <Input
              id="profile-share-url"
              readOnly
              value={profileUrl}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copyLink()} disabled={copying}>
                {copying ? 'Copying…' : 'Copy link'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void shareLink()}
                disabled={sharing}
              >
                {sharing ? 'Opening share…' : 'Share link'}
              </Button>
            </div>
          </div>

          <section className="grid justify-items-center gap-3" aria-label="Profile QR code">
            <h3 className="text-sm font-medium">QR code</h3>
            {qr?.dataUrl ? (
              <img
                className="rounded-md bg-white p-2"
                src={qr.dataUrl}
                alt={`QR code for ${name}'s public profile`}
                width={224}
                height={224}
              />
            ) : qr?.error ? (
              <p role="status" className="text-sm text-muted-foreground">
                {qr.error}
              </p>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                Preparing QR code…
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!qr?.dataUrl}
              onClick={() => {
                if (!qr?.dataUrl) return;
                const link = document.createElement('a');
                link.href = qr.dataUrl;
                link.download = `credora-profile-${handle}.png`;
                link.click();
              }}
            >
              Download QR PNG
            </Button>
          </section>

          {feedback && (
            <p
              role={feedback.tone === 'error' ? 'alert' : 'status'}
              aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
            >
              {feedback.message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
