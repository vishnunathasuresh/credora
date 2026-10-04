'use client';
import { WalletGuide } from './wallet-guide';
import { Button } from './ui/button';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRightIcon, CheckIcon } from './icons';
import { CredentialCard } from './credential-card';
import { WalletShare } from './wallet-share';
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
  organization_name: string | null;
  organization_logo_url: string | null;
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
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (current: WalletSession) => {
    setLoaded(false);
    setSession(current);
    setError('');
    const me = await credoraApi<WalletSession>('/me', {}, current.token);
    const list = await credoraApi<{ items: CredentialRow[] }>('/credentials', {}, current.token);
    setSession({ ...current, ...me });
    setCredentials(list.items);
    setLoaded(true);
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
    setLoaded(false);
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
          <Button className="text-button" type="button" onClick={disconnect}>
            Disconnect {shortAddress(session.address)}
          </Button>
        ) : null}
      </div>
      {!session ? (
        <section className="workspace-panel workspace-connect">
          <h2>Connect your wallet.</h2>
          <p>
            Credora uses a signed session to show credentials bound to this learner address. It
            never asks for your private key.
          </p>
          <Button className="button button-dark" type="button" onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect learner wallet'}
          </Button>
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
          {!loaded ? (
            <div className="empty-state" role="status">
              <strong>{error ? 'Credentials unavailable' : 'Loading your credentials…'}</strong>
              <span>
                {error
                  ? 'The service could not load your library. This does not mean you have no credentials.'
                  : 'Reading the issuer’s credential list.'}
              </span>
              {error ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await load(session);
                    } catch (caught) {
                      setError(
                        caught instanceof Error ? caught.message : 'Unable to load credentials.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Retry loading credentials
                </Button>
              ) : null}
            </div>
          ) : credentials.length ? (
            <>
              <WalletShare credentials={credentials} />
              <div className="credential-list credential-card-list">
                {credentials.map((credential) => (
                  <div className="holder-credential-item" key={credential.credential_hash}>
                    <CredentialCard
                      metadata={{
                        schemaVersion: 1,
                        skillName: credential.skill_name,
                        skillLevel: credential.skill_level,
                        issueDate: credential.issue_date,
                        issuerAddress: credential.issuer as `0x${string}`,
                        learnerAddress: credential.learner as `0x${string}`,
                      }}
                      credentialHash={credential.credential_hash}
                      issuerProfile={
                        credential.organization_name
                          ? {
                              name: credential.organization_name,
                              websiteUrl: '',
                              logoUrl: credential.organization_logo_url,
                            }
                          : null
                      }
                      verified={false}
                    />
                    <div className="credential-actions">
                      <a className="text-link" href={`/verify/${credential.credential_hash}`}>
                        Verify public record <ArrowUpRightIcon />
                      </a>
                      <Button
                        className="text-button"
                        type="button"
                        onClick={() => copyLink(credential.credential_hash)}
                      >
                        {copied === credential.credential_hash ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
      {!session ? <WalletGuide /> : null}
    </main>
  );
}
