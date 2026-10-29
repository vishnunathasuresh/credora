'use client';
import { WalletGuide } from './wallet-guide';
import { Button } from './ui/button';
import { Link } from '@tanstack/react-router';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRightIcon, CheckIcon } from './icons';
import { credoraApi } from '../lib/credora-api';
import { connectWalletSession, storedSession, type WalletSession } from '../lib/wallet-session';

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

type WorkspacePath = '/superadmin' | '/org' | '/issuer' | '/wallet' | '/verify';

export function RoleDashboard() {
  const [session, setSession] = useState<WalletSession>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (current: WalletSession) => {
    const me = await credoraApi<WalletSession>('/me', {}, current.token);
    setSession({ ...current, ...me });
  }, []);

  useEffect(() => {
    const current = storedSession();
    if (current)
      void refresh(current).catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Session unavailable.'),
      );
  }, [refresh]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      await refresh(await connectWalletSession());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Wallet connection failed.');
    } finally {
      setBusy(false);
    }
  }

  const links: { href: WorkspacePath; title: string; body: string }[] = session
    ? [
        ...(session.roles.includes('SUPERADMIN') || session.roles.includes('ADMIN')
          ? [
              {
                href: '/superadmin' as const,
                title: 'Superadmin control',
                body: 'Authorize issuers, inspect protocol health, and reconcile projections.',
              },
            ]
          : []),
        ...(session.roles.includes('ORG_ADMIN')
          ? [
              {
                href: '/org' as const,
                title: 'Organization workspace',
                body: 'Manage organizational issuance operations and activity.',
              },
            ]
          : []),
        ...(!session.roles.includes('ORG_ADMIN')
          ? [
              {
                href: '/org' as const,
                title: 'Request an organization workspace',
                body: 'Submit your wallet and organization name for superadmin review.',
              },
            ]
          : []),
        ...(session.roles.includes('ISSUER')
          ? [
              {
                href: '/issuer' as const,
                title: 'Issuer workspace',
                body: 'Prepare and confirm immutable credential proofs.',
              },
            ]
          : []),
        ...(session.roles.includes('LEARNER')
          ? [
              {
                href: '/wallet' as const,
                title: 'Credential wallet',
                body: 'Find your public proofs and share verification links.',
              },
            ]
          : []),
        {
          href: '/verify' as const,
          title: 'Public verification',
          body: 'Check a credential without connecting a wallet.',
        },
      ]
    : [];

  return (
    <main className="page-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>Your workspaces</h1>
          <p className="lede">Choose a workspace available to your connected wallet.</p>
        </div>
      </div>
      {!session ? (
        <section className="workspace-panel workspace-connect app-connect-state">
          <h2>Connect to see your workspaces</h2>
          <p>
            Your wallet determines which organization and issuer tools are available. The session
            uses a signature only.
          </p>
          <Button className="button button-dark" type="button" onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect wallet'}
          </Button>
          {error ? (
            <p className="form-help form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <div className="workspace-session-bar">
            <span className="status-badge status-success">
              <CheckIcon /> Connected {shortAddress(session.address)}
            </span>
            <span className="panel-note">{session.roles.join(' · ')}</span>
          </div>
          <div className="role-grid">
            {links.map((link) => (
              <Link className="role-link" to={link.href} key={link.href}>
                <div>
                  <h2>{link.title}</h2>
                  <p>{link.body}</p>
                </div>
                <ArrowUpRightIcon />
              </Link>
            ))}
          </div>
        </>
      )}
      {!session ? <WalletGuide /> : null}
    </main>
  );
}
