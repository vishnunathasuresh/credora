'use client';

import { useState, type FormEvent } from 'react';
import { credentialRegistryAbi } from '@credora/contracts';
import { createWalletClient, custom, defineChain, getAddress, isAddress } from 'viem';
import { AlertIcon, CheckIcon } from './icons';
import { credoraApi } from '../lib/credora-api';
import {
  browserWalletProvider,
  connectWalletSession,
  type WalletSession,
} from '../lib/wallet-session';

const contractAddress = process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS;
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function AdminWorkspace() {
  const [session, setSession] = useState<WalletSession>();
  const [issuer, setIssuer] = useState('');
  const [authorized, setAuthorized] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [overview, setOverview] = useState<{
    ledger: { configured: boolean; chainId: number; registryAddress: string | null };
    projections: { issuances: number; confirmed: number; auditEvents: number };
  }>();

  const isSuperadmin =
    session?.roles.includes('SUPERADMIN') || session?.roles.includes('ADMIN') || false;

  async function loadOverview(current: WalletSession) {
    const response = await credoraApi<typeof overview>('/superadmin/overview', {}, current.token);
    setOverview(response);
  }

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const next = await connectWalletSession();
      setSession(next);
      if (next.roles.includes('SUPERADMIN') || next.roles.includes('ADMIN'))
        await loadOverview(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Wallet connection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    setError('');
    setMessage('');
    if (!isAddress(issuer)) {
      setError('Enter a valid issuer wallet address.');
      return;
    }
    if (!session) return;
    setBusy(true);
    try {
      const response = await credoraApi<{ issuers: { address: string; authorized: boolean }[] }>(
        `/admin/issuers?address=${encodeURIComponent(getAddress(issuer))}`,
        {},
        session.token,
      );
      setAuthorized(response.issuers[0]?.authorized ?? false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authorization status unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    setError('');
    setMessage('');
    if (!session) return;
    setBusy(true);
    try {
      const response = await credoraApi<{
        synced: boolean;
        reason?: string;
        events?: number;
      }>('/admin/reconcile', { method: 'POST', body: JSON.stringify({}) }, session.token);
      if (!response.synced) {
        setMessage('The registry is unavailable. The projection was left unchanged.');
        return;
      }
      setMessage(`Projection reconciled. ${response.events ?? 0} chain events processed.`);
      await loadOverview(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Projection reconciliation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!session || !isSuperadmin) return;
    if (!contractAddress) {
      setError('Set NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS before authorizing issuers.');
      return;
    }
    if (!isAddress(issuer)) {
      setError('Enter a valid issuer wallet address.');
      return;
    }
    setBusy(true);
    try {
      const provider = browserWalletProvider();
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts[0] || getAddress(accounts[0]) !== session.address)
        throw new Error('Switch the browser wallet back to the connected admin account.');
      const chain = defineChain({
        id: chainId,
        name: `Credora chain ${chainId}`,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
      });
      const walletClient = createWalletClient({
        account: session.address,
        chain,
        transport: custom(provider),
      });
      const transactionHash = await walletClient.writeContract({
        address: getAddress(contractAddress),
        abi: credentialRegistryAbi,
        functionName: 'setIssuerAuthorization',
        args: [getAddress(issuer), true],
      });
      await credoraApi(
        '/admin/issuer-authorizations/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            issuer: getAddress(issuer),
            authorized: true,
            transactionHash,
          }),
        },
        session.token,
      );
      setAuthorized(true);
      setMessage(`Issuer ${shortAddress(getAddress(issuer))} is now authorized on the registry.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Issuer authorization failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>Superadmin control.</h1>
          <p className="lede">
            Manage protocol-level authority and inspect system projections. The API can confirm a
            transaction, but it cannot grant authority.
          </p>
        </div>
      </div>
      {!session ? (
        <section className="workspace-panel workspace-connect">
          <h2>Connect the superadmin wallet.</h2>
          <p>
            This action requires the registry administrator account and a browser wallet connected
            to the configured chain.
          </p>
          <button className="button button-dark" type="button" onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect admin wallet'}
          </button>
          {error ? (
            <p className="form-help form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : !isSuperadmin ? (
        <section className="workspace-panel">
          <div className="status-badge status-warning">
            <AlertIcon /> Superadmin role required
          </div>
          <h2>This wallet cannot manage protocol authority.</h2>
          <p>
            Connected wallet: {shortAddress(session.address)}. Switch to the registry administrator
            account and connect again.
          </p>
          {error ? (
            <p className="form-help form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="workspace-panel workspace-connect">
          <div className="panel-header">
            <div>
              <p className="panel-label">Protocol authority</p>
              <h2>Authorize an issuer.</h2>
            </div>
            <span className="status-badge status-success">
              <CheckIcon /> Superadmin connected
            </span>
          </div>
          {overview ? (
            <div className="overview-stats" aria-label="Protocol overview">
              <div>
                <strong>{overview.projections.issuances}</strong>
                <span>issuances projected</span>
              </div>
              <div>
                <strong>{overview.projections.confirmed}</strong>
                <span>confirmed proofs</span>
              </div>
              <div>
                <strong>{overview.projections.auditEvents}</strong>
                <span>audit events</span>
              </div>
              <div>
                <strong>{overview.ledger.configured ? 'Ready' : 'Offline'}</strong>
                <span>registry status</span>
              </div>
            </div>
          ) : null}
          <form className="workspace-form" onSubmit={submit} aria-busy={busy}>
            <label>
              Issuer wallet address
              <input
                value={issuer}
                onChange={(event) => {
                  setIssuer(event.target.value);
                  setAuthorized(undefined);
                }}
                placeholder="0x…"
                required
                spellCheck={false}
              />
            </label>
            <div className="form-actions">
              <button className="button button-dark" type="submit" disabled={busy}>
                Authorize issuer
              </button>
              <button className="text-button" type="button" onClick={checkStatus} disabled={busy}>
                Check current status
              </button>
              <button className="text-button" type="button" onClick={reconcile} disabled={busy}>
                Reconcile projection
              </button>
            </div>
          </form>
          {authorized !== undefined ? (
            <p className="form-help" role="status">
              Current registry status:{' '}
              <strong>{authorized ? 'authorized' : 'not authorized'}</strong>.
            </p>
          ) : null}
          {message ? (
            <p className="form-help" role="status">
              {message}
            </p>
          ) : null}
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
