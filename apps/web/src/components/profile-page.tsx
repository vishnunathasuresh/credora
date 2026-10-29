import { useEffect, useState, type FormEvent } from 'react';
import { credoraApi, type ApiError } from '../lib/credora-api';
import { connectWalletSession, storedSession, type WalletSession } from '../lib/wallet-session';
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
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your profile</h1>
      <p className="mt-3 text-muted-foreground">
        Share the work and credentials you want people to see.
      </p>
      {error && (
        <p role="alert" className="mt-5 text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-5">
          {message}
        </p>
      )}
      {!session ? (
        <Button className="mt-8 min-h-11" onClick={() => void connect()} disabled={loading}>
          {loading ? 'Connecting…' : 'Connect wallet to continue'}
        </Button>
      ) : !loaded ? (
        <div className="mt-8 flex flex-col items-start gap-4" role={loading ? 'status' : undefined}>
          <p>{loading ? 'Loading your profile…' : 'Your profile could not be loaded.'}</p>
          {!loading && (
            <Button variant="outline" onClick={() => void load(session)}>
              Try loading again
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="mt-8 flex flex-col gap-7">
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
          <fieldset className="flex flex-col gap-3">
            <legend className="font-medium">Featured credentials</legend>
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
                Publishing can connect your identity to public wallet records. Unpublishing removes
                this page but cannot remove public proofs or copies.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <Button className="min-h-11" disabled={loading || !loaded}>
              {loading ? 'Saving…' : 'Save profile'}
            </Button>
            {profile.published && profile.id && (
              <a
                className="text-primary underline"
                href={`/u/${encodeURIComponent(profile.handle)}`}
              >
                View public profile
              </a>
            )}
          </div>
        </form>
      )}
    </main>
  );
}

export function PublicProfile({ handle }: { handle: string }) {
  const [profile, setProfile] = useState<Profile>();
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'unavailable' | 'error'>(
    'loading',
  );
  const isCurrentProfile = profile?.handle.toLowerCase() === handle.toLowerCase();
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
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      {(state === 'loading' || (state === 'found' && !isCurrentProfile)) && (
        <p role="status">Loading profile…</p>
      )}
      {state === 'missing' && <h1 className="text-3xl font-semibold">Profile not found</h1>}
      {state === 'unavailable' && (
        <div role="alert">
          <h1 className="text-3xl font-semibold">Profile unavailable</h1>
          <p className="mt-3 text-muted-foreground">
            The profile service could not be reached. Please try again later.
          </p>
        </div>
      )}
      {state === 'error' && (
        <div role="alert">
          <h1 className="text-3xl font-semibold">Could not load profile</h1>
          <p className="mt-3 text-muted-foreground">Please try again later.</p>
        </div>
      )}
      {state === 'found' && profile && isCurrentProfile && (
        <article>
          <p className="text-muted-foreground">@{profile.handle}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{profile.name}</h1>
          {profile.headline && <p className="mt-4 text-xl">{profile.headline}</p>}
          {profile.bio && <p className="mt-8 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>}
          {profile.links.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-4">
              {profile.links.map((link) => (
                <li key={link}>
                  <a
                    className="break-all text-primary underline"
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {profile.credentialHashes.length > 0 && (
            <section className="mt-14 border-t pt-8">
              <h2 className="text-2xl font-semibold">Credentials</h2>
              <ul className="mt-5 flex flex-col gap-3">
                {profile.credentialHashes.map((hash) => (
                  <li key={hash}>
                    <a
                      className="block min-h-11 break-all rounded-md border p-4 text-primary hover:underline"
                      href={`/verify/${encodeURIComponent(hash)}`}
                    >
                      View credential {hash}
                    </a>
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
