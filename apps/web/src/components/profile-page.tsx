import { Link } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { credoraApi, type ApiError } from '../lib/credora-api';
import {
  connectWalletSession,
  forgetSession,
  storedSession,
  type WalletSession,
} from '../lib/wallet-session';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

type Profile = {
  id: string;
  handle: string;
  name: string;
  headline: string;
  bio: string;
  links: string[];
  credentialHashes: string[];
  published: boolean;
};
type Credential = { credential_hash: string; skill_name: string; organization_name: string | null };
const emptyProfile: Profile = {
  id: '',
  handle: '',
  name: '',
  headline: '',
  bio: '',
  links: [],
  credentialHashes: [],
  published: false,
};

export function ProfileEditor() {
  const [session, setSession] = useState<WalletSession>();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [links, setLinks] = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load(current: WalletSession) {
    setLoading(true);
    setLoaded(false);
    setError('');
    try {
      const [result, items] = await Promise.all([
        credoraApi<{ profile: Profile | null }>('/profile', {}, current.token),
        credoraApi<{ items: Credential[] }>('/credentials?limit=100', {}, current.token),
      ]);
      const next = result.profile ?? emptyProfile;
      setProfile(next);
      setLinks(next.links.join('\n'));
      setCredentials(items.items);
      setLoaded(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const current = storedSession();
    if (current) {
      setSession(current);
      void load(current);
    }
  }, []);
  function disconnect() {
    forgetSession();
    window.location.reload();
  }
  useEffect(() => {
    const provider = (
      window as Window & {
        ethereum?: {
          on?: (event: string, callback: () => void) => void;
          removeListener?: (event: string, callback: () => void) => void;
        };
      }
    ).ethereum;
    if (!session || !provider?.on) return;
    provider.on('accountsChanged', disconnect);
    provider.on('disconnect', disconnect);
    return () => {
      provider.removeListener?.('accountsChanged', disconnect);
      provider.removeListener?.('disconnect', disconnect);
    };
  }, [session?.address]);
  async function connect() {
    setError('');
    setLoading(true);
    try {
      const current = await connectWalletSession();
      setSession(current);
      await load(current);
    } catch (cause) {
      setError((cause as Error).message);
      setLoading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session || !loaded || loading) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await credoraApi<{ profile: Profile }>(
        '/profile',
        {
          method: 'PUT',
          body: JSON.stringify({
            ...profile,
            links: links
              .split('\n')
              .map((link) => link.trim())
              .filter(Boolean),
          }),
        },
        session.token,
      );
      setProfile(result.profile);
      setLinks(result.profile.links.join('\n'));
      setMessage('Profile saved.');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="page-width workspace-page">
      <header className="app-page-header">
        <div>
          <h1>Edit your profile</h1>
          <p>Choose the identity and credentials people can see.</p>
        </div>
        {session && (
          <span className="panel-note">
            Wallet {session.address.slice(0, 6)}…{session.address.slice(-4)}
          </span>
        )}
      </header>
      {session && (
        <Button variant="ghost" className="mt-4" type="button" onClick={disconnect}>
          Disconnect wallet
        </Button>
      )}
      {error && (
        <p role="alert" className="form-help form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="form-help">
          {message}
        </p>
      )}
      {!session ? (
        <section className="workspace-panel app-connect-state">
          <h2>Connect to edit your profile</h2>
          <p>
            Your profile stays under your control. Connecting signs a session message; it does not
            send a transaction.
          </p>
          <Button className="min-h-11" onClick={() => void connect()} disabled={loading}>
            {loading ? 'Connecting…' : 'Connect wallet'}
          </Button>
        </section>
      ) : !loaded ? (
        <div className="workspace-panel app-empty-state" role={loading ? 'status' : undefined}>
          <p>{loading ? 'Loading your profile…' : 'Your profile could not be loaded.'}</p>
          {!loading && (
            <Button variant="outline" onClick={() => void load(session)}>
              Try loading again
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="workspace-form profile-editor-form">
          <section className="workspace-panel" aria-labelledby="profile-identity-title">
            <h2 id="profile-identity-title">Profile identity</h2>
            <p className="form-help">Your name and handle identify this public page.</p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  required
                  maxLength={100}
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-handle">Handle</Label>
                <Input
                  id="profile-handle"
                  required
                  maxLength={30}
                  value={profile.handle}
                  onChange={(e) => setProfile({ ...profile, handle: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  3–30 letters, numbers or underscores. Changes are limited to once every 30 days.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-headline">Headline</Label>
              <Input
                id="profile-headline"
                maxLength={160}
                value={profile.headline}
                onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea
                id="profile-bio"
                maxLength={1000}
                rows={5}
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-links">Links</Label>
              <Textarea
                id="profile-links"
                rows={3}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">One full URL per line, up to 10.</p>
            </div>
          </section>
          <section className="workspace-panel" aria-labelledby="profile-featured-title">
            <fieldset className="flex flex-col gap-3">
              <legend id="profile-featured-title" className="text-lg font-semibold">
                Featured credentials
              </legend>
              <p className="text-sm text-muted-foreground">
                Choose which credentials appear on your public profile.
              </p>
              {credentials.length === 0 && (
                <p className="text-sm text-muted-foreground">No credentials available yet.</p>
              )}
              {credentials.map((item) => (
                <label
                  key={item.credential_hash}
                  className="flex min-h-11 items-center gap-3 rounded-md border p-3"
                >
                  <input
                    type="checkbox"
                    checked={profile.credentialHashes.includes(item.credential_hash.toLowerCase())}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        credentialHashes: e.target.checked
                          ? [...profile.credentialHashes, item.credential_hash.toLowerCase()]
                          : profile.credentialHashes.filter(
                              (hash) => hash !== item.credential_hash.toLowerCase(),
                            ),
                      })
                    }
                  />
                  <span className="min-w-0 break-all">
                    {item.skill_name || item.credential_hash}
                    {item.organization_name ? ` · ${item.organization_name}` : ''}
                  </span>
                </label>
              ))}
            </fieldset>
          </section>
          <section className="workspace-panel" aria-labelledby="profile-publication-title">
            <h2 id="profile-publication-title">Publication</h2>
            <label className="flex items-start gap-3 rounded-md border p-4">
              <input
                type="checkbox"
                className="mt-1"
                checked={profile.published}
                onChange={(e) => setProfile({ ...profile, published: e.target.checked })}
              />
              <span>
                <strong>Publish profile</strong>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Publishing can connect your identity to public wallet records. Unpublishing
                  removes this page but cannot remove public proofs or copies.
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <Button className="min-h-11" disabled={loading || !loaded}>
                {loading ? 'Saving…' : 'Save profile'}
              </Button>
              {profile.published && profile.id && (
                <Link
                  className="text-primary underline"
                  to="/u/$handle"
                  params={{ handle: profile.handle }}
                >
                  View public profile
                </Link>
              )}
            </div>
          </section>
        </form>
      )}
    </main>
  );
}

export function PublicProfile({ handle }: { handle: string }) {
  const [profile, setProfile] = useState<Profile>();
  const [shareResult, setShareResult] = useState<{ tone: 'status' | 'error'; message: string }>();
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'unavailable' | 'error'>(
    'loading',
  );
  const isCurrentProfile = profile?.handle.toLowerCase() === handle.toLowerCase();
  async function shareProfile() {
    const url = window.location.href;
    setShareResult(undefined);
    setShowManualUrl(false);

    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.name ?? 'Credora profile',
          text: profile?.headline || `@${profile?.handle ?? handle}`,
          url,
        });
        setShareResult({ tone: 'status', message: 'Profile shared.' });
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          setShareResult({ tone: 'status', message: 'Sharing was canceled.' });
          return;
        }
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText(url);
      setShareResult({ tone: 'status', message: 'Profile link copied.' });
    } catch {
      setShowManualUrl(true);
      setShareResult({
        tone: 'error',
        message: 'Could not copy the link. Select and copy the profile URL below.',
      });
    }
  }
  useEffect(() => {
    let active = true;
    setState('loading');
    credoraApi<{ profile: Profile }>(`/profiles/${encodeURIComponent(handle)}`)
      .then((result) => {
        if (active) {
          setProfile(result.profile);
          setState('found');
        }
      })
      .catch((error: ApiError) => {
        if (active)
          setState(
            error.status === 404 || error.status === 400
              ? 'missing'
              : error.code === 'API_UNAVAILABLE' || (error.status ?? 0) >= 500
                ? 'unavailable'
                : 'error',
          );
      });
    return () => {
      active = false;
    };
  }, [handle]);
  return (
    <main className="page-width workspace-page public-profile-page">
      {(state === 'loading' || (state === 'found' && !isCurrentProfile)) && (
        <p role="status">Loading profile…</p>
      )}
      {state === 'missing' && (
        <section className="workspace-panel app-empty-state">
          <h1>Profile not found</h1>
          <p>This profile may be private or the handle may have changed.</p>
        </section>
      )}
      {state === 'unavailable' && (
        <div className="workspace-panel app-empty-state" role="alert">
          <h1 className="text-3xl font-semibold">Profile unavailable</h1>
          <p className="mt-3 text-muted-foreground">
            The profile service could not be reached. Please try again later.
          </p>
        </div>
      )}
      {state === 'error' && (
        <div className="workspace-panel app-empty-state" role="alert">
          <h1 className="text-3xl font-semibold">Could not load profile</h1>
          <p className="mt-3 text-muted-foreground">Please try again later.</p>
        </div>
      )}
      {state === 'found' && profile && isCurrentProfile && (
        <article>
          <section className="workspace-panel public-profile-hero">
            <div className="profile-monogram" aria-hidden="true">
              {profile.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('')}
            </div>
            <div className="public-profile-intro">
              <p className="profile-handle">@{profile.handle}</p>
              <h1>{profile.name}</h1>
              {profile.headline && <p className="public-profile-headline">{profile.headline}</p>}
            </div>
            <div className="profile-share-actions">
              <Button type="button" variant="outline" onClick={() => void shareProfile()}>
                Share profile
              </Button>
              {shareResult && (
                <p role={shareResult.tone === 'error' ? 'alert' : 'status'}>
                  {shareResult.message}
                </p>
              )}
              {showManualUrl && (
                <Input
                  aria-label="Public profile URL"
                  readOnly
                  value={typeof window === 'undefined' ? '' : window.location.href}
                  onFocus={(event) => event.currentTarget.select()}
                />
              )}
            </div>
          </section>
          {profile.bio && (
            <section className="workspace-panel">
              <h2>About</h2>
              <p className="whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
            </section>
          )}
          {profile.links.length > 0 && (
            <ul className="workspace-panel profile-links">
              {profile.links.map((link) => (
                <li key={link}>
                  <a
                    className="text-link break-all"
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    title={link}
                  >
                    {(() => {
                      try {
                        return new URL(link).hostname;
                      } catch {
                        return link;
                      }
                    })()}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {profile.credentialHashes.length > 0 && (
            <section className="workspace-panel">
              <h2>Featured credentials</h2>
              <ul className="profile-featured-list">
                {profile.credentialHashes.map((hash) => (
                  <li key={hash}>
                    <Link
                      className="block min-h-11 break-all rounded-md border p-4 text-primary hover:underline"
                      to="/verify/$credentialRef"
                      params={{ credentialRef: hash }}
                    >
                      View credential {hash}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </main>
  );
}
