import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { accountApi } from '../lib/account-api';
import {
  AccountAuthError,
  accountAuthConfigured,
  getAccountSession,
  finishGoogleCallback,
  signInWithGoogle,
} from '../lib/account-session';
import { Button } from './ui/button';

type EntryStatus = 'checking' | 'ready' | 'redirecting' | 'finishing' | 'unavailable' | 'failed';

export function JoinPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<EntryStatus>(
    accountAuthConfigured() ? 'checking' : 'unavailable',
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accountAuthConfigured()) return;
    let active = true;
    void getAccountSession()
      .then(async (session) => {
        if (!session) {
          if (active) setStatus('ready');
          return;
        }
        await accountApi('/account');
        if (active) void navigate({ to: '/profile' });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Could not check your account.');
        setStatus('failed');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function continueWithGoogle() {
    setError('');
    setStatus('redirecting');
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in could not be started.');
      setStatus(
        cause instanceof AccountAuthError && cause.code === 'CONFIG_MISSING'
          ? 'unavailable'
          : 'failed',
      );
    }
  }

  return (
    <main className="page-width narrow-page account-entry-page">
      <section className="workspace-panel account-entry-panel">
        <h1>Create your Credora profile</h1>
        <p className="lede">Start with your name and a handle. You can add credentials later.</p>
        {status === 'unavailable' ? (
          <div className="form-help form-error" role="alert">
            Google sign-in is not configured for this environment. Please try again later.
          </div>
        ) : null}
        {status === 'failed' ? (
          <div className="form-help form-error" role="alert">
            {error || 'Sign-in could not be completed.'}
          </div>
        ) : null}
        {status === 'checking' || status === 'finishing' ? (
          <p role="status">Checking your account…</p>
        ) : status !== 'unavailable' ? (
          <Button
            className="min-h-11 w-full"
            onClick={() => void continueWithGoogle()}
            disabled={status === 'redirecting'}
          >
            {status === 'redirecting' ? 'Opening Google…' : 'Continue with Google'}
          </Button>
        ) : null}
        {status === 'failed' ? (
          <Button
            className="mt-3 w-full"
            variant="outline"
            onClick={() => void continueWithGoogle()}
          >
            Try again
          </Button>
        ) : null}
        <p className="mt-5 text-sm text-muted-foreground">
          You can build your profile without connecting a wallet.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center text-sm text-primary underline"
          to="/verify"
        >
          Verify a credential without signing in
        </Link>
      </section>
    </main>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<EntryStatus>('finishing');
  const [error, setError] = useState('');

  async function complete() {
    setError('');
    setStatus('finishing');
    try {
      await finishGoogleCallback();
      await accountApi('/account');
      void navigate({ to: '/profile' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in could not be completed.');
      setStatus(
        cause instanceof AccountAuthError && cause.code === 'CONFIG_MISSING'
          ? 'unavailable'
          : 'failed',
      );
    }
  }

  useEffect(() => {
    void complete();
    // Callback code exchange is guarded in account-session and must run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page-width narrow-page account-entry-page">
      <section className="workspace-panel account-entry-panel">
        <h1>
          {status === 'failed' || status === 'unavailable'
            ? 'Sign-in could not finish'
            : 'Finishing sign-in'}
        </h1>
        {status === 'finishing' ? <p role="status">Connecting your account…</p> : null}
        {error ? (
          <p className="form-help form-error" role="alert">
            {error}
          </p>
        ) : null}
        {status === 'failed' || status === 'unavailable' ? (
          <Button className="mt-3 w-full" variant="outline" onClick={() => void complete()}>
            Try again
          </Button>
        ) : null}
        {status === 'failed' || status === 'unavailable' ? (
          <Link
            className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline"
            to="/join"
          >
            Back to sign in
          </Link>
        ) : null}
      </section>
    </main>
  );
}
