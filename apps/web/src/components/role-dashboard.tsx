'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRightIcon, CheckIcon } from './icons';
import { credoraApi } from '../lib/credora-api';
import { connectWalletSession, storedSession, type WalletSession } from '../lib/wallet-session';

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

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

  const links = session
    ? [
        ...(session.roles.includes('SUPERADMIN') || session.roles.includes('ADMIN')
          ? [
              {
                href: '/superadmin',
                title: 'Superadmin control',
                body: 'Authorize issuers, inspect protocol health, and reconcile projections.',
              },
            ]
          : []),
        ...(session.roles.includes('ORG_ADMIN')
          ? [
              {
                href: '/org',
                title: 'Organization workspace',
                body: 'Manage organizational issuance operations and activity.',
              },
            ]
          : []),
        ...(session.roles.includes('ISSUER')
          ? [
              {
                href: '/issuer',
                title: 'Issuer workspace',
                body: 'Prepare and confirm immutable credential proofs.',
              },
            ]
          : []),
        ...(session.roles.includes('LEARNER')
          ? [
              {
                href: '/wallet',
                title: 'Credential wallet',
                body: 'Find your public proofs and share verification links.',
              },
            ]
          : []),
        {
          href: '/verify',
          title: 'Public verification',
          body: 'Check a credential without connecting a wallet.',
        },
      ]
    : [];

  return (
    <main className="page-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>Choose your Credora workspace.</h1>
          <p className="lede">
            One protocol, different responsibilities. Your wallet determines which tools are
            available.
          </p>
        </div>
      </div>
      {!session ? (
        <section className="workspace-panel workspace-connect">
          <h2>Connect your wallet.</h2>
          <p>Credora signs a session challenge only. Private keys stay in the browser wallet.</p>
          <button className="button button-dark" type="button" onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect wallet'}
          </button>
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
              <a className="role-link" href={link.href} key={link.href}>
                <div>
                  <h2>{link.title}</h2>
                  <p>{link.body}</p>
                </div>
                <ArrowUpRightIcon />
              </a>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
