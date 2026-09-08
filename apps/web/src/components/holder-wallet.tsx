'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRightIcon, CheckIcon } from './icons';
import { credoraApi } from '../lib/credora-api';
import {
  connectWalletSession,
  forgetSession,
  storedSession,
  type WalletSession,
} from '../lib/wallet-session';

type CredentialRow = {
  credential_hash: string;
  issuer: string;
  learner: string;
  issue_date: string;
  skill_name: string;
  skill_level: string;
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function HolderWallet() {
  const [session, setSession] = useState<WalletSession>();
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  const load = useCallback(async (current: WalletSession) => {
    const me = await credoraApi<WalletSession>('/me', {}, current.token);
    const list = await credoraApi<{ items: CredentialRow[] }>('/credentials', {}, current.token);
    setSession({ ...current, ...me });
    setCredentials(list.items);
  }, []);

  useEffect(() => {
    const current = storedSession();
    if (current)
      void load(current).catch((caught) => {
        setSession(current);
        setError(caught instanceof Error ? caught.message : 'Unable to load wallet data.');
      });
  }, [load]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      await load(await connectWalletSession());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Wallet connection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(hash: string) {
    const link = `${window.location.origin}/verify/${hash}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(hash);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setError(
        'The link could not be copied. Open the verification page and copy its URL instead.',
      );
    }
  }

  function disconnect() {
    forgetSession();
    setSession(undefined);
    setCredentials([]);
  }

  return (
    <main className="page-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>Your credential wallet.</h1>
          <p className="lede">
            Keep public proof links in one place. Verification remains open to anyone.
          </p>
        </div>
        {session ? (
          <button className="text-button" type="button" onClick={disconnect}>
            Disconnect {shortAddress(session.address)}
          </button>
        ) : null}
      </div>
      {!session ? (
        <section className="workspace-panel workspace-connect">
          <h2>Connect your wallet.</h2>
          <p>
            Credora uses a signed session to show credentials bound to this learner address. It
            never asks for your private key.
          </p>
          <button className="button button-dark" type="button" onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect learner wallet'}
          </button>
          {error ? (
            <p className="form-help form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="workspace-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Connected learner</p>
              <h2>{shortAddress(session.address)}</h2>
            </div>
            <span className="status-badge status-success">
              <CheckIcon /> Session active
            </span>
          </div>
          <div className="wallet-note">
            <strong>Public proof, private control.</strong>
            <span>
              This view is an API projection for convenience. Each link still resolves through the
              immutable registry and metadata proof.
            </span>
          </div>
          {credentials.length ? (
            <div className="credential-list">
              {credentials.map((credential) => (
                <article className="credential-row" key={credential.credential_hash}>
                  <div>
                    <span className="state-label state-confirmed">confirmed on chain</span>
                    <h3>{credential.skill_name}</h3>
                    <p>
                      {credential.skill_level} · issued{' '}
                      {new Date(credential.issue_date).toLocaleDateString()}
                    </p>
                    <span className="credential-issuer">
                      Issuer {shortAddress(credential.issuer)}
                    </span>
                  </div>
                  <div className="credential-actions">
                    <a className="text-link" href={`/verify/${credential.credential_hash}`}>
                      Verify <ArrowUpRightIcon />
                    </a>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => copyLink(credential.credential_hash)}
                    >
                      {copied === credential.credential_hash ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No confirmed credentials found.</strong>
              <span>
                Once an issuer confirms a credential for this wallet, it will appear here.
              </span>
            </div>
          )}
          {error ? (
            <p className="form-help form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}
