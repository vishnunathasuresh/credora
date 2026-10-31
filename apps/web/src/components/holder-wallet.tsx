import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRightIcon } from './icons';
import { Button } from './ui/button';
import { WalletShare } from './wallet-share';
import { accountApi, type AccountProfileResponse } from '../lib/account-api';
import { accountAuthConfigured, subscribeAccountSession } from '../lib/account-session';

type CredentialRow = {
  credential_hash: string;
  issuer: string;
  learner: string;
  issue_date: string;
  skill_name: string;
  skill_level: string;
  organization_name: string | null;
};
type Profile = {
  handle: string;
  name: string;
  credentialHashes: string[];
  [key: string]: unknown;
};
type Library = AccountProfileResponse<Profile> & { items: CredentialRow[] };
type State = 'loading' | 'signed-out' | 'ready' | 'error';

export function HolderWallet() {
  const [state, setState] = useState<State>('loading');
  const [library, setLibrary] = useState<Library>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const accountUser = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const request = ++generation.current;
    if (!accountAuthConfigured()) {
      setState('signed-out');
      return;
    }
    void subscribeAccountSession((session) => {
      const current = ++generation.current;
      accountUser.current = session?.user.id;
      setLibrary(undefined);
      setError('');
      setNotice('');
      if (!session) {
        setState('signed-out');
        return;
      }
      setState('loading');
      // Auth callbacks stay synchronous; SDK calls happen after its lock is released.
      void Promise.resolve().then(async () => {
        if (!active || current !== generation.current) return;
        try {
          const [account, credentials] = await Promise.all([
            accountApi<AccountProfileResponse<Profile>>('/account'),
            accountApi<{ items: CredentialRow[] }>('/account/credentials'),
          ]);
          if (active && current === generation.current) {
            setLibrary({ ...account, items: credentials.items });
            setState('ready');
          }
        } catch (cause) {
          if (active && current === generation.current) {
            setError(cause instanceof Error ? cause.message : 'Could not load your credentials.');
            setState('error');
          }
        }
      });
    })
      .then((stop) => {
        if (active) unsubscribe = stop;
        else stop();
      })
      .catch((cause: unknown) => {
        if (active && request <= generation.current) {
          setError(cause instanceof Error ? cause.message : 'Could not check your account.');
          setState('error');
        }
      });
    return () => {
      active = false;
      ++generation.current;
      unsubscribe?.();
    };
  }, [retry]);

  async function addToProfile(hash: string) {
    if (adding) return;
    const current = generation.current;
    const userId = accountUser.current;
    if (!userId) return;
    setAdding(hash);
    setError('');
    setNotice('');
    try {
      const { profile } = await accountApi<{ profile: Profile | null }>(
        '/account/profile',
        {},
        userId,
      );
      if (!profile) throw new Error('Create your profile before featuring a credential.');
      const hashes = profile.credentialHashes;
      if (hashes.some((item) => item.toLowerCase() === hash.toLowerCase())) {
        setNotice('This credential is already featured on your profile.');
        return;
      }
      const result = await accountApi<{ profile: Profile }>(
        '/account/profile',
        {
          method: 'PUT',
          body: JSON.stringify({ ...profile, credentialHashes: [...hashes, hash] }),
        },
        userId,
      );
      if (current === generation.current) {
        setLibrary((previous) => previous && { ...previous, profile: result.profile });
        setNotice('Credential added to your profile.');
      }
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : 'Could not add the credential.');
    } finally {
      if (current === generation.current) setAdding('');
    }
  }

  return (
    <main className="page-width workspace-page">
      <header className="app-page-header">
        <div>
          <h1>My credentials</h1>
          <p>Your achievements, backed by the organizations that issued them.</p>
        </div>
        {library && (
          <Button asChild variant="outline">
            <Link to="/settings/wallets">Manage wallets</Link>
          </Button>
        )}
      </header>
      {state === 'loading' && <p role="status">Loading your credentials…</p>}
      {state === 'signed-out' && (
        <section className="workspace-panel app-connect-state">
          <h2>Your work belongs here.</h2>
          <p>Sign in to build your profile and collect your credentials.</p>
          <Button asChild>
            <Link to="/join">Continue with Google</Link>
          </Button>
          <Link className="text-link" to="/verify">
            Verify a credential without signing in
          </Link>
        </section>
      )}
      {state === 'error' && (
        <section className="workspace-panel app-empty-state">
          <h2>Credentials unavailable</h2>
          <p>This does not mean your library is empty.</p>
          <p role="alert">{error}</p>
          <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </Button>
        </section>
      )}
      {state === 'ready' && library && (
        <>
          {library.profile && (
            <div className="flex flex-wrap items-center justify-between gap-4 py-6">
              <div>
                <strong>{library.profile.name}</strong>
                <p className="text-muted-foreground">@{library.profile.handle}</p>
              </div>
              <Link className="text-link" to="/profile">
                Edit your profile <ArrowUpRightIcon />
              </Link>
            </div>
          )}
          {!library.wallets.length ? (
            <section className="workspace-panel app-empty-state">
              <h2>Bring your achievements into your profile.</h2>
              <p>Link the wallet that received your credentials. Your profile works without one.</p>
              <Button asChild>
                <Link to="/settings/wallets">Link a wallet</Link>
              </Button>
            </section>
          ) : !library.items.length ? (
            <section className="workspace-panel app-empty-state">
              <h2>Your next achievement starts here.</h2>
              <p>Credentials appear after an organization confirms issuance to a linked wallet.</p>
              <Button asChild variant="outline">
                <Link to="/settings/wallets">Link another wallet</Link>
              </Button>
            </section>
          ) : (
            <>
              <div className="grid gap-4">
                {library.items.map((credential) => {
                  const featured = library.profile?.credentialHashes.some(
                    (hash) => hash.toLowerCase() === credential.credential_hash.toLowerCase(),
                  );
                  return (
                    <article className="workspace-panel" key={credential.credential_hash}>
                      <h2>{credential.skill_name}</h2>
                      <p className="text-muted-foreground">
                        {credential.organization_name || 'Independent issuer'} ·{' '}
                        <time>{credential.issue_date}</time>
                      </p>
                      <p>{credential.skill_level}</p>
                      <div className="flex flex-wrap items-center gap-3 pt-4">
                        <Button asChild variant="outline">
                          <Link
                            to="/verify/$credentialRef"
                            params={{ credentialRef: credential.credential_hash }}
                          >
                            View credential
                          </Link>
                        </Button>
                        {library.profile ? (
                          <Button
                            variant="outline"
                            disabled={Boolean(adding) || featured}
                            onClick={() => void addToProfile(credential.credential_hash)}
                          >
                            {featured
                              ? 'Added to profile'
                              : adding === credential.credential_hash
                                ? 'Adding…'
                                : 'Add to profile'}
                          </Button>
                        ) : (
                          <Button asChild variant="outline">
                            <Link to="/profile">Create your profile</Link>
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <WalletShare credentials={library.items} />
            </>
          )}
          {notice && (
            <p role="status" className="form-help">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="form-help form-error">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
}
