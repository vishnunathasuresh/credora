'use client';
import { WalletGuide } from './wallet-guide';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ReactQRCode, type ReactQRCodeRef } from '@lglab/react-qr-code';
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
  organization: { id: string; name: string } | null;
  issuerAuthorization: 'authorized' | 'not-authorized' | 'unavailable';
  projection: string;
  projectionNote: string;
};

type OrganizationApplication = {
  id: string;
  organizationName: string;
  websiteUrl: string;
  applicantAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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
  const [organizationApplication, setOrganizationApplication] =
    useState<OrganizationApplication | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationWebsite, setOrganizationWebsite] = useState('');
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationReviewUrl, setApplicationReviewUrl] = useState('');
  const applicationQrRef = useRef<ReactQRCodeRef>(null);
  const [form, setForm] = useState(initialForm);
  const [phase, setPhase] = useState<IssuancePhase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<IssuanceResponse>();
  const [connecting, setConnecting] = useState(false);

  const isIssuer =
    audience === 'organization'
      ? organizationOverview?.issuerAuthorization === 'authorized'
      : (session?.roles.includes('ISSUER') ?? false);
  const issuerStatus =
    audience === 'organization'
      ? (organizationOverview?.issuerAuthorization ?? 'unavailable')
      : isIssuer
        ? 'authorized'
        : 'not-authorized';
  const isOrgAdmin = session?.roles.includes('ORG_ADMIN') ?? false;
  const hasWorkspaceAccess = audience === 'organization' ? isOrgAdmin : true;
  const busy = !['idle', 'confirmed', 'error'].includes(phase);

  useEffect(() => {
    if (organizationApplication?.status === 'pending')
      setApplicationReviewUrl(
        `${window.location.origin}/superadmin?organizationApplication=${encodeURIComponent(organizationApplication.id)}`,
      );
    else setApplicationReviewUrl('');
  }, [organizationApplication?.id, organizationApplication?.status]);

  const loadWorkspace = useCallback(
    async (current: WalletSession) => {
      const me = await credoraApi<WalletSession>('/me', {}, current.token);
      const refreshed = { ...current, ...me };
      setSession(refreshed);
      if (audience === 'organization') {
        const mine = await credoraApi<{ application: OrganizationApplication | null }>(
          '/org/applications/mine',
          {},
          current.token,
        );
        setOrganizationApplication(mine.application);
      }
      if (
        (audience === 'organization' && !refreshed.roles.includes('ORG_ADMIN')) ||
        (!refreshed.roles.includes('ISSUER') && !refreshed.roles.includes('ORG_ADMIN'))
      ) {
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

  async function submitOrganizationApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setApplicationBusy(true);
    setError('');
    try {
      const application = await credoraApi<OrganizationApplication>(
        '/org/applications',
        {
          method: 'POST',
          body: JSON.stringify({ organizationName, websiteUrl: organizationWebsite }),
        },
        session.token,
      );
      setOrganizationApplication(application);
      setOrganizationName('');
      setOrganizationWebsite('');
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setApplicationBusy(false);
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
          <Button className="text-button" type="button" onClick={disconnect}>
            Disconnect {shortAddress(session.address)}
          </Button>
        ) : null}
      </div>

      {!session ? (
        <section className="workspace-panel workspace-connect">
          <h2>Connect the {audience === 'organization' ? 'applicant' : 'issuer'} wallet.</h2>
          <p>
            Credora asks the wallet to sign a one-time session challenge. Private keys never enter
            the API.
          </p>
          <Button
            className="button button-dark"
            type="button"
            onClick={connect}
            disabled={connecting}
          >
            {connecting
              ? 'Connecting…'
              : audience === 'organization'
                ? 'Connect applicant wallet'
                : 'Connect issuer wallet'}
          </Button>
          {error ? (
            <p className="form-help form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : !hasWorkspaceAccess ? (
        <section className="workspace-panel workspace-connect">
          {organizationApplication?.status === 'pending' ? (
            <>
              <div className="status-badge status-warning">Awaiting superadmin review</div>
              <h2>{organizationApplication.organizationName}</h2>
              <p>
                Your request is pending. An administrator must review and approve it before this
                wallet receives organization access. Scanning this QR opens the protected request in
                the superadmin workspace; it does not approve the request.
              </p>
              {applicationReviewUrl ? (
                <div className="organization-application-qr">
                  <ReactQRCode
                    ref={applicationQrRef}
                    value={applicationReviewUrl}
                    size={232}
                    marginSize={4}
                    level="H"
                    background="#ffffff"
                    dataModulesSettings={{ color: '#111827', style: 'rounded' }}
                    finderPatternOuterSettings={{ color: '#111827', style: 'rounded-sm' }}
                    finderPatternInnerSettings={{ color: '#111827', style: 'rounded-sm' }}
                    svgProps={{
                      role: 'img',
                      'aria-label': 'QR code for the superadmin organization review',
                    }}
                  />
                </div>
              ) : (
                <p role="status">Preparing the protected review QR…</p>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={!applicationReviewUrl}
                onClick={() =>
                  applicationQrRef.current?.download({
                    name: 'credora-organization-review',
                    format: 'png',
                    size: 640,
                  })
                }
              >
                Download QR to share
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={applicationBusy}
                onClick={() => {
                  setApplicationBusy(true);
                  setError('');
                  void loadWorkspace(session)
                    .catch((caught) => setError(friendlyError(caught)))
                    .finally(() => setApplicationBusy(false));
                }}
              >
                {applicationBusy ? 'Checking…' : 'Check review status'}
              </Button>
              <p className="form-help">
                Applicant wallet:{' '}
                <code>{shortAddress(organizationApplication.applicantAddress)}</code>
              </p>
            </>
          ) : organizationApplication?.status === 'approved' ? (
            <>
              <div className="status-badge status-warning">
                <AlertIcon /> Organization access unavailable
              </div>
              <h2>{organizationApplication.organizationName}</h2>
              <p>
                This organization’s access is currently suspended. Contact a Credora superadmin.
              </p>
            </>
          ) : (
            <>
              <div className="status-badge status-warning">
                <AlertIcon />{' '}
                {organizationApplication?.status === 'rejected'
                  ? 'Request not approved'
                  : 'Organization access requires approval'}
              </div>
              <h2>
                {organizationApplication?.status === 'rejected'
                  ? 'Submit a new request.'
                  : 'Request an organization workspace.'}
              </h2>
              <p>
                A superadmin reviews every request. Submitting creates a pending application only;
                it cannot grant roles or authorize credential issuance. Your connected wallet will
                own the request if it is approved.
              </p>
              <form
                className="workspace-form"
                onSubmit={submitOrganizationApplication}
                aria-busy={applicationBusy}
              >
                <Label>
                  Organization name
                  <Input
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder="Example Learning Institute"
                    minLength={2}
                    maxLength={120}
                    autoComplete="organization"
                    required
                  />
                </Label>
                <Label>
                  Official organization website
                  <Input
                    type="url"
                    inputMode="url"
                    value={organizationWebsite}
                    onChange={(event) => setOrganizationWebsite(event.target.value)}
                    placeholder="https://example.org"
                    maxLength={2048}
                    required
                  />
                </Label>
                <p className="form-help">
                  The website is self-reported. A superadmin checks it independently before
                  approving. Your wallet signature proves control of the requesting address only.
                </p>
                <Button className="button button-dark" type="submit" disabled={applicationBusy}>
                  {applicationBusy ? 'Submitting request…' : 'Submit for superadmin review'}
                </Button>
              </form>
            </>
          )}
          {error ? (
            <p className="form-help form-error" role="alert">
              {error}
            </p>
          ) : null}
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
                <span className="panel-note">
                  {organizationOverview.organization?.name ?? 'Configured organization'} ·{' '}
                  {organizationOverview.projection}
                </span>
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
                <span
                  className={`status-badge status-${issuerStatus === 'authorized' ? 'success' : 'warning'}`}
                >
                  {issuerStatus === 'authorized' ? <CheckIcon /> : <AlertIcon />}
                  {issuerStatus === 'authorized'
                    ? 'Authorized issuer'
                    : issuerStatus === 'unavailable'
                      ? 'Issuer status unavailable'
                      : 'Not authorized'}
                </span>
              </div>
              {!isIssuer ? (
                <p className="form-help form-error">
                  {issuerStatus === 'unavailable'
                    ? 'The registry could not be reached, so issuer permission cannot be confirmed. No issuance has been started.'
                    : 'This wallet is not authorized by the registry to issue credentials. Ask a superadmin to authorize it on-chain.'}
                  {audience === 'organization' && issuerStatus === 'unavailable' ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={applicationBusy}
                      onClick={() => {
                        setApplicationBusy(true);
                        setError('');
                        void loadWorkspace(session!)
                          .catch((caught) => setError(friendlyError(caught)))
                          .finally(() => setApplicationBusy(false));
                      }}
                    >
                      {applicationBusy ? 'Checking…' : 'Retry registry check'}
                    </Button>
                  ) : null}
                </p>
              ) : (
                <form className="workspace-form" onSubmit={submit} aria-busy={busy}>
                  <Label>
                    Learner wallet address
                    <Input
                      value={form.learnerAddress}
                      onChange={(event) => updateField('learnerAddress', event.target.value)}
                      placeholder="0x…"
                      required
                      spellCheck={false}
                    />
                  </Label>
                  <Label>
                    Skill or credential name
                    <Input
                      value={form.skillName}
                      onChange={(event) => updateField('skillName', event.target.value)}
                      placeholder="Systems thinking"
                      required
                    />
                  </Label>
                  <div className="form-two-column">
                    <Label>
                      Level
                      <NativeSelect
                        value={form.skillLevel}
                        onChange={(event) => updateField('skillLevel', event.target.value)}
                      >
                        <NativeSelectOption>Foundational</NativeSelectOption>
                        <NativeSelectOption>Intermediate</NativeSelectOption>
                        <NativeSelectOption>Advanced</NativeSelectOption>
                        <NativeSelectOption>Expert</NativeSelectOption>
                      </NativeSelect>
                    </Label>
                    <Label>
                      Issue date
                      <Input
                        type="date"
                        value={form.issueDate}
                        onChange={(event) => updateField('issueDate', event.target.value)}
                        required
                      />
                    </Label>
                  </div>
                  <Label>
                    Public description <span className="field-optional">Optional</span>
                    <Textarea
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      placeholder="Keep this concise and free of unnecessary personal data."
                      rows={4}
                    />
                  </Label>
                  <div className="form-actions">
                    <Button className="button button-dark" type="submit" disabled={busy}>
                      {busy ? 'Working…' : 'Prepare and issue'}
                    </Button>
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
      {!session ? <WalletGuide /> : null}
    </main>
  );
}
