import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ApiError } from '../lib/credora-api';
import { accountApi, type AccountProfileResponse } from '../lib/account-api';
import { accountAuthConfigured, getAccountSession } from '../lib/account-session';
import { browserWalletProvider } from '../lib/wallet-session';
import { Button } from './ui/button';

type Wallet = { address: `0x${string}`; linkedAt: string };
type AccountData = AccountProfileResponse & { wallets: Wallet[] };
type WalletChallenge = {
  id: string;
  message: string;
  expiresAt: string;
  legacyProfile?: { handle: string };
  migrationRequired: boolean;
};
type WalletPageState = 'loading' | 'ready' | 'unavailable' | 'error';
type PendingAction =
  | { type: 'link'; address: `0x${string}`; challenge: WalletChallenge }
  | { type: 'unlink'; address: `0x${string}` };

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function apiMessage(error: unknown, fallback: string) {
  const cause = error as ApiError;
  if (cause.code === 'WALLET_ALREADY_LINKED')
    return 'This wallet is already linked to another account.';
  if (cause.code === 'PROFILE_CONFLICT')
    return 'This account already has a profile. The legacy profile was left unchanged.';
  if (cause.code === 'INVALID_SIGNATURE')
    return 'The signature did not match this wallet. Try again.';
  if (cause.code === 'CHALLENGE_EXPIRED')
    return 'The wallet request expired. Start again to get a fresh request.';
  if (cause.code === 'API_UNAVAILABLE')
    return 'The account service could not be reached. Try again.';
  return cause.message || fallback;
}

export function AccountWalletSettings() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountData>();
  const [state, setState] = useState<WalletPageState>('loading');
  const [pending, setPending] = useState<PendingAction>();
  const [importLegacyProfile, setImportLegacyProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setState('loading');
    setError('');
    try {
      const result = await accountApi<AccountData>('/account');
      setAccount(result);
      setState('ready');
    } catch (cause) {
      setError(apiMessage(cause, 'Your account could not be loaded.'));
      setState('error');
    }
  }

  useEffect(() => {
    if (!accountAuthConfigured()) {
      setState('unavailable');
      return;
    }
    let active = true;
    void getAccountSession()
      .then((session) => {
        if (!active) return;
        if (!session) {
          void navigate({ to: '/join' });
          return;
        }
        void load();
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Your account session is unavailable.');
        setState('error');
      });
    return () => {
      active = false;
    };
    // load and navigate are stable for this route instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startLink() {
    setError('');
    setNotice('');
    setPending(undefined);
    setImportLegacyProfile(false);
    setBusy(true);
    try {
      const provider = browserWalletProvider();
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const rawAddress = accounts[0];
      if (!rawAddress) throw new Error('Choose a wallet account to continue.');
      const address = rawAddress as `0x${string}`;
      const challenge = await accountApi<WalletChallenge>('/account/wallets/challenge', {
        method: 'POST',
        body: JSON.stringify({ address, action: 'link' }),
      });
      if (challenge.migrationRequired && challenge.legacyProfile) {
        setPending({ type: 'link', address, challenge });
      } else {
        await signAndVerifyLink(address, challenge, false);
      }
    } catch (cause) {
      setError(apiMessage(cause, 'The wallet could not be linked.'));
    } finally {
      setBusy(false);
    }
  }

  async function signAndVerifyLink(
    address: `0x${string}`,
    challenge: WalletChallenge,
    importProfile: boolean,
  ) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const provider = browserWalletProvider();
      const signature = await provider.request({
        method: 'personal_sign',
        params: [challenge.message, address],
      });
      if (typeof signature !== 'string') throw new Error('The wallet did not return a signature.');
      const result = await accountApi<{ wallets: Wallet[]; profile: AccountData['profile'] }>(
        '/account/wallets/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            challengeId: challenge.id,
            signature,
            ...(challenge.migrationRequired ? { importLegacyProfile: importProfile } : {}),
          }),
        },
      );
      setAccount((current) =>
        current ? { ...current, wallets: result.wallets, profile: result.profile } : current,
      );
      setPending(undefined);
      setImportLegacyProfile(false);
      setNotice(
        challenge.migrationRequired && importProfile
          ? `Wallet linked and @${challenge.legacyProfile?.handle} moved to your account.`
          : `${shortAddress(address)} linked. No transaction or gas was required.`,
      );
    } catch (cause) {
      setError(apiMessage(cause, 'Wallet proof could not be confirmed.'));
    } finally {
      setBusy(false);
    }
  }

  async function startUnlink(address: `0x${string}`) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const challenge = await accountApi<WalletChallenge>('/account/wallets/challenge', {
        method: 'POST',
        body: JSON.stringify({ address, action: 'unlink' }),
      });
      const provider = browserWalletProvider();
      const signature = await provider.request({
        method: 'personal_sign',
        params: [challenge.message, address],
      });
      if (typeof signature !== 'string') throw new Error('The wallet did not return a signature.');
      const result = await accountApi<{ wallets: Wallet[]; profile: AccountData['profile'] }>(
        '/account/wallets/verify',
        {
          method: 'POST',
          body: JSON.stringify({ challengeId: challenge.id, signature }),
        },
      );
      setAccount((current) =>
        current ? { ...current, wallets: result.wallets, profile: result.profile } : current,
      );
      setNotice(
        `${shortAddress(address)} removed. Its featured credentials were removed from your profile.`,
      );
      setPending(undefined);
    } catch (cause) {
      setError(apiMessage(cause, 'The wallet could not be removed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-width workspace-page">
      <header className="app-page-header">
        <div>
          <h1>Linked wallets</h1>
          <p>Connect a wallet when you want to add its confirmed credentials to your profile.</p>
        </div>
        <Link className="text-link" to="/profile">
          Back to profile
        </Link>
      </header>
      {error ? (
        <p className="form-help form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-help" role="status">
          {notice}
        </p>
      ) : null}
      {state === 'unavailable' ? (
        <section className="workspace-panel app-empty-state" role="alert">
          <h2>Account sign-in is unavailable</h2>
          <p>Wallet settings need an account session. Try again later.</p>
        </section>
      ) : state === 'loading' ? (
        <section className="workspace-panel app-empty-state" role="status">
          Loading linked wallets…
        </section>
      ) : state === 'error' ? (
        <section className="workspace-panel app-empty-state">
          <h2>Wallet settings could not load</h2>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </section>
      ) : (
        <section className="workspace-panel">
          <p className="max-w-prose text-muted-foreground">
            Linking proves that you control a wallet now. It does not transfer credentials or prove
            that a profile name belongs to you. Your wallet list is not published automatically.
          </p>
          {account?.wallets.length ? (
            <ul className="mt-6 divide-y">
              {account.wallets.map((wallet) => (
                <li
                  key={wallet.address}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="font-medium">{shortAddress(wallet.address)}</p>
                    <p className="text-sm text-muted-foreground">
                      Linked {new Date(wallet.linkedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setPending({ type: 'unlink', address: wallet.address })}
                  >
                    Remove wallet
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-muted-foreground">
              No wallets linked. Your profile and account work without one.
            </p>
          )}
          {pending?.type === 'link' ? (
            <div className="mt-6 rounded-lg border p-4" aria-labelledby="legacy-profile-title">
              <h2 id="legacy-profile-title" className="font-semibold">
                A profile already uses this wallet
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Link {shortAddress(pending.address)} to this account. Import the existing profile to
                continue. Its publication setting will be preserved.
              </p>
              {pending.challenge.legacyProfile ? (
                <label className="mt-4 flex min-h-11 items-start gap-3">
                  <input
                    className="mt-1 size-4 accent-primary"
                    type="checkbox"
                    checked={importLegacyProfile}
                    onChange={(event) => setImportLegacyProfile(event.target.checked)}
                  />
                  <span>
                    Import <strong>@{pending.challenge.legacyProfile.handle}</strong> and let this
                    Google account edit it. Its profile content and publication setting will be
                    preserved.
                  </span>
                </label>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void signAndVerifyLink(pending.address, pending.challenge, importLegacyProfile)
                  }
                >
                  {busy ? 'Waiting for wallet…' : 'Sign and link wallet'}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setPending(undefined)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          {pending?.type === 'unlink' ? (
            <div
              className="mt-6 rounded-lg border p-4"
              role="group"
              aria-label="Confirm wallet removal"
            >
              <h2 className="font-semibold">Remove {shortAddress(pending.address)}?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This requires a fresh wallet signature. Credentials from this wallet will be removed
                from your profile selection. The issued records remain unchanged, and linking again
                will not republish them.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void startUnlink(pending.address)}
                >
                  {busy ? 'Waiting for wallet…' : 'Sign and remove wallet'}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setPending(undefined)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          {!pending ? (
            <Button className="mt-6 min-h-11" disabled={busy} onClick={() => void startLink()}>
              {busy ? 'Connecting wallet…' : 'Link a wallet'}
            </Button>
          ) : null}
        </section>
      )}
    </main>
  );
}
