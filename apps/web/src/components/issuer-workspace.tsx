'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { credentialRegistryAbi } from '@credora/contracts';
import { createWalletClient, custom, defineChain, getAddress, isAddress, type Hex } from 'viem';
import { AlertIcon, ArrowUpRightIcon, CheckIcon } from './icons';
import { CredentialShare } from './credential-share';
import { credoraApi, type ApiError } from '../lib/credora-api';
import {
  browserWalletProvider,
  connectWalletSession,
  forgetSession,
  storedSession,
  type WalletSession,
} from '../lib/wallet-session';

type IssuancePhase =
  'idle' | 'drafting' | 'uploading' | 'awaiting-wallet' | 'confirming' | 'confirmed' | 'error';

type IssuanceRow = {
  id: string;
  learner: string;
  skill_name: string;
  skill_level: string;
  issue_date: string;
  credential_hash?: string;
  transaction_hash?: string;
  state: string;
};

type IssuanceResponse = {
  id: string;
  state: string;
  credentialHash?: string;
  uri?: string;
  transactionHash?: string;
  blockNumber?: string;
};

type OrganizationOverview = {
  issuanceCounts: Record<string, number>;
  projection: string;
  projectionNote: string;
};

const contractAddress = process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS;
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

const initialForm = {
  learnerAddress: '',
  skillName: '',
  skillLevel: 'Advanced',
  issueDate: new Date().toISOString().slice(0, 10),
  description: '',
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : 'The issuance could not be completed.';
}

async function issueOnChain(
  session: WalletSession,
  credentialHash: string,
  learner: string,
  uri: string,
) {
  if (!contractAddress)
    throw new Error('Set NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS before issuing on-chain.');
  const provider = browserWalletProvider();
  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
  if (!accounts[0] || getAddress(accounts[0]) !== session.address)
    throw new Error('Switch the browser wallet back to the connected issuer account.');
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
  return walletClient.writeContract({
    address: getAddress(contractAddress),
    abi: credentialRegistryAbi,
    functionName: 'issueCredential',
    args: [credentialHash as Hex, getAddress(learner), uri],
  });
}

export function IssuerWorkspace({ audience = 'issuer' }: { audience?: 'issuer' | 'organization' }) {
  const [session, setSession] = useState<WalletSession>();
  const [issuances, setIssuances] = useState<IssuanceRow[]>([]);
  const [organizationOverview, setOrganizationOverview] = useState<OrganizationOverview>();
  const [form, setForm] = useState(initialForm);
  const [phase, setPhase] = useState<IssuancePhase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<IssuanceResponse>();
  const [connecting, setConnecting] = useState(false);

  const isIssuer = session?.roles.includes('ISSUER') ?? false;
  const isOrgAdmin = session?.roles.includes('ORG_ADMIN') ?? false;
  const hasWorkspaceAccess = audience === 'organization' ? isOrgAdmin || isIssuer : true;
  const busy = !['idle', 'confirmed', 'error'].includes(phase);

  const loadWorkspace = useCallback(
    async (current: WalletSession) => {
      const me = await credoraApi<WalletSession>('/me', {}, current.token);
      const refreshed = { ...current, ...me };
      setSession(refreshed);
      if (!refreshed.roles.includes('ISSUER') && !refreshed.roles.includes('ORG_ADMIN')) {
        setIssuances([]);
        return;
      }
      if (audience === 'organization') {
        const overview = await credoraApi<OrganizationOverview>('/org/overview', {}, current.token);
        setOrganizationOverview(overview);
      }
      const list = await credoraApi<{ items: IssuanceRow[] }>('/issuances', {}, current.token);
      setIssuances(list.items);
    },
    [audience],
  );

  useEffect(() => {
    const current = storedSession();
    if (current)
      void loadWorkspace(current).catch((caught) => {
        setSession(current);
        setError(friendlyError(caught));
      });
  }, [loadWorkspace]);

  async function connect() {
    setConnecting(true);
    setError('');
    try {
      const next = await connectWalletSession();
      await loadWorkspace(next);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setConnecting(false);
    }
  }

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isIssuer) return;
    setError('');
    setResult(undefined);
    try {
      if (!isAddress(form.learnerAddress)) throw new Error('Enter a valid learner wallet address.');
      setPhase('drafting');
      const draft = await credoraApi<IssuanceResponse>(
        '/issuances',
        {
          method: 'POST',
          body: JSON.stringify({
            learnerAddress: getAddress(form.learnerAddress),
            skillName: form.skillName,
            skillLevel: form.skillLevel,
            issueDate: new Date(`${form.issueDate}T00:00:00.000Z`).toISOString(),
          }),
        },
        session.token,
      );
      setPhase('uploading');
      const metadata = await credoraApi<IssuanceResponse>(
        `/issuances/${draft.id}/metadata`,
        {
          method: 'POST',
          body: JSON.stringify({ description: form.description || undefined }),
        },
        session.token,
      );
      if (!metadata.credentialHash || !metadata.uri)
        throw new Error('The metadata upload did not return a proof reference.');
      setResult(metadata);
      setPhase('awaiting-wallet');
      const transactionHash = await issueOnChain(
        session,
        metadata.credentialHash,
        getAddress(form.learnerAddress),
        metadata.uri,
      );
      setPhase('confirming');
      const confirmed = await credoraApi<IssuanceResponse>(
        `/issuances/${draft.id}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({ transactionHash, credentialHash: metadata.credentialHash }),
        },
        session.token,
      );
      setResult({ ...metadata, ...confirmed, transactionHash });
      setPhase('confirmed');
      await loadWorkspace(session);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(
        apiError.status === 503
          ? `${friendlyError(caught)} Retry after the ledger or storage source recovers.`
          : friendlyError(caught),
      );
      setPhase('error');
    }
  }

  function disconnect() {
    forgetSession();
    setSession(undefined);
    setIssuances([]);
    setResult(undefined);
    setPhase('idle');
  }

  const phaseCopy = useMemo(() => {
    switch (phase) {
      case 'drafting':
        return 'Saving the issuance draft…';
      case 'uploading':
        return 'Writing the public metadata manifest…';
      case 'awaiting-wallet':
        return 'Approve the issuance transaction in your wallet.';
      case 'confirming':
        return 'Waiting for the registry to confirm the transaction…';
      case 'confirmed':
        return 'Credential confirmed on the registry.';
      case 'error':
        return 'The operation stopped before confirmation.';
      default:
        return 'Draft, publish, and confirm one immutable credential.';
    }
  }, [phase]);

  return (
    <main className="page-width workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>{audience === 'organization' ? 'Organization workspace.' : 'Issue a credential.'}</h1>
          <p className="lede">
            {audience === 'organization'
              ? 'Manage your organization’s issuance work while the registry keeps authority on-chain.'
              : 'Prepare a public proof, then confirm it from an authorized issuer wallet.'}
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
          <h2>Connect the {audience === 'organization' ? 'organization' : 'issuer'} wallet.</h2>
          <p>
            Credora asks the wallet to sign a one-time session challenge. Private keys never enter
            the API.
          </p>
          <button
            className="button button-dark"
            type="button"
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? 'Connecting…' : 'Connect issuer wallet'}
          </button>
        </section>
      ) : !hasWorkspaceAccess ? (
        <section className="workspace-panel workspace-connect">
          <div className="status-badge status-warning">
            <AlertIcon /> Organization role required
          </div>
          <h2>This wallet is not assigned to an organization.</h2>
          <p>Connect a wallet with the organization-admin role to access this workspace.</p>
        </section>
      ) : (
        <>
          {audience === 'organization' && organizationOverview ? (
            <section
              className="workspace-panel workspace-summary"
              aria-label="Organization overview"
            >
              <div className="panel-header">
                <div>
                  <p className="panel-label">Operational projection</p>
                  <h2>Organization overview</h2>
                </div>
                <span className="panel-note">{organizationOverview.projection}</span>
              </div>
              <div className="overview-stats">
                <div>
                  <strong>{organizationOverview.issuanceCounts.draft ?? 0}</strong>
                  <span>drafts</span>
                </div>
                <div>
                  <strong>{organizationOverview.issuanceCounts.metadata_ready ?? 0}</strong>
                  <span>metadata ready</span>
                </div>
                <div>
                  <strong>{organizationOverview.issuanceCounts.pending_chain ?? 0}</strong>
                  <span>pending chain</span>
                </div>
                <div>
                  <strong>{organizationOverview.issuanceCounts.confirmed ?? 0}</strong>
                  <span>confirmed</span>
                </div>
              </div>
              <p className="panel-note">{organizationOverview.projectionNote}</p>
            </section>
          ) : null}
          <div className="workspace-grid">
            <section className="workspace-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-label">
                    {audience === 'organization' ? 'Organization workflow' : 'Issuance workflow'}
                  </p>
                  <h2>New credential</h2>
                </div>
                <span className={`status-badge status-${isIssuer ? 'success' : 'warning'}`}>
                  {isIssuer ? <CheckIcon /> : <AlertIcon />}
                  {isIssuer ? 'Authorized issuer' : 'Not authorized'}
                </span>
              </div>
              {!isIssuer ? (
                <p className="form-help form-error">
                  This wallet is connected, but the registry has not authorized it to issue
                  credentials.
                </p>
              ) : (
                <form className="workspace-form" onSubmit={submit} aria-busy={busy}>
                  <label>
                    Learner wallet address
                    <input
                      value={form.learnerAddress}
                      onChange={(event) => updateField('learnerAddress', event.target.value)}
                      placeholder="0x…"
                      required
                      spellCheck={false}
                    />
                  </label>
                  <label>
                    Skill or credential name
                    <input
                      value={form.skillName}
                      onChange={(event) => updateField('skillName', event.target.value)}
                      placeholder="Systems thinking"
                      required
                    />
                  </label>
                  <div className="form-two-column">
                    <label>
                      Level
                      <select
                        value={form.skillLevel}
                        onChange={(event) => updateField('skillLevel', event.target.value)}
                      >
                        <option>Foundational</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                        <option>Expert</option>
                      </select>
                    </label>
                    <label>
                      Issue date
                      <input
                        type="date"
                        value={form.issueDate}
                        onChange={(event) => updateField('issueDate', event.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Public description <span className="field-optional">Optional</span>
                    <textarea
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      placeholder="Keep this concise and free of unnecessary personal data."
                      rows={4}
                    />
                  </label>
                  <div className="form-actions">
                    <button className="button button-dark" type="submit" disabled={busy}>
                      {busy ? 'Working…' : 'Prepare and issue'}
                    </button>
                    <span className="form-help" aria-live="polite">
                      {phaseCopy}
                    </span>
                  </div>
                </form>
              )}
              {error ? (
                <p className="form-help form-error" role="alert">
                  {error}
                </p>
              ) : null}
              {result?.credentialHash && phase === 'confirmed' ? (
                <div className="success-summary" role="status">
                  <CheckIcon />
                  <div>
                    <strong>Credential confirmed.</strong>
                    <span>Share the public verification link with the learner.</span>
                    <a className="text-link" href={`/verify/${result.credentialHash}`}>
                      Open verification <ArrowUpRightIcon />
                    </a>
                    <CredentialShare
                      credentialHash={result.credentialHash}
                      credentialName={form.skillName}
                    />
                  </div>
                </div>
              ) : null}
            </section>

            <section className="workspace-panel workspace-history">
              <div className="panel-header">
                <div>
                  <p className="panel-label">Projection view</p>
                  <h2>Recent issuances</h2>
                </div>
                <span className="panel-note">API convenience state</span>
              </div>
              {issuances.length ? (
                <div className="issuance-list">
                  {issuances.map((issuance) => (
                    <article className="issuance-row" key={issuance.id}>
                      <div>
                        <strong>{issuance.skill_name}</strong>
                        <span>
                          {issuance.skill_level} · learner {shortAddress(issuance.learner)}
                        </span>
                      </div>
                      <span className={`state-label state-${issuance.state}`}>
                        {issuance.state.replaceAll('-', ' ')}
                      </span>
                      {issuance.credential_hash ? (
                        <a
                          href={`/verify/${issuance.credential_hash}`}
                          aria-label={`Verify ${issuance.skill_name}`}
                        >
                          <ArrowUpRightIcon />
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>No issuances yet.</strong>
                  <span>
                    Your confirmed credentials will appear here as a rebuildable projection.
                  </span>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
