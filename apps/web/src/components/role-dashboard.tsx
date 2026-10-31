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

type WorkspacePath = '/superadmin' | '/org' | '/issuer';

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
      ]
    : [];

  return (
    <main className="page-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>Your space</h1>
          <p className="lede">Build your profile and bring your achievements together.</p>
        </div>
      </div>
      <section className="workspace-overview" aria-label="Your profile and credentials">
        <Link className="workspace-overview-link" to="/profile">
          <div>
            <h2>My profile</h2>
            <p>Tell your story and choose what to publish.</p>
          </div>
          <ArrowUpRightIcon />
        </Link>
        <Link className="workspace-overview-link" to="/credentials">
          <div>
            <h2>My credentials</h2>
            <p>Explore and share achievements issued to you.</p>
          </div>
          <ArrowUpRightIcon />
        </Link>
      </section>
      <div className="workspace-tools-heading">
        <h2>Organization tools</h2>
        <p>For issuing and managing credentials on behalf of an organization.</p>
      </div>
      {!session ? (
        <section className="workspace-panel workspace-connect app-connect-state">
          <h2>Connect a wallet to continue</h2>
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
