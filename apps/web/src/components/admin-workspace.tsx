'use client';
import { WalletGuide } from './wallet-guide';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

import { useEffect, useState, type FormEvent } from 'react';
import { credentialRegistryAbi } from '@credora/contracts';
import { createWalletClient, custom, defineChain, getAddress, isAddress } from 'viem';
import { AlertIcon, CheckIcon } from './icons';
import { credoraApi } from '../lib/credora-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  browserWalletProvider,
  connectWalletSession,
  type WalletSession,
} from '../lib/wallet-session';

const contractAddress = process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS;
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

type OrganizationApplication = {
  id: string;
  organizationName: string;
  websiteUrl: string;
  applicantAddress: string;
  status: string;
  createdAt: string;
};
type OrganizationRecord = {
  id: string;
  name: string;
  websiteUrl: string;
  adminAddress: string;
  status: 'active' | 'suspended';
  createdAt: string;
};
type OrganizationReviewAction = 'review' | 'approve' | 'reject' | 'suspend' | 'reactivate';

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
  const [applications, setApplications] = useState<OrganizationApplication[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [reviewAction, setReviewAction] = useState<OrganizationReviewAction>();
  const [reviewTarget, setReviewTarget] = useState('');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('organizationApplication');
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setSelectedApplicationId(id);
  }, []);

  useEffect(() => {
    if (selectedApplicationId && applications.some((item) => item.id === selectedApplicationId)) {
      setReviewTarget(selectedApplicationId);
      setReviewAction('review');
    }
  }, [applications, selectedApplicationId]);

  const isSuperadmin =
    session?.roles.includes('SUPERADMIN') || session?.roles.includes('ADMIN') || false;

  async function loadOverview(current: WalletSession) {
    setQueueLoaded(false);
    const [response, reviewQueue] = await Promise.all([
      credoraApi<NonNullable<typeof overview>>('/superadmin/overview', {}, current.token),
      credoraApi<{ applications: OrganizationApplication[]; organizations: OrganizationRecord[] }>(
        '/superadmin/organization-applications',
        {},
        current.token,
      ),
    ]);
    setOverview(response);
    setApplications(reviewQueue.applications);
    setOrganizations(reviewQueue.organizations);
    setQueueLoaded(true);
  }

  async function decideOrganization(
    action: Exclude<OrganizationReviewAction, 'review'> = reviewAction as Exclude<
      OrganizationReviewAction,
      'review'
    >,
  ) {
    if (!session || !action || !reviewTarget) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const isApplication = action === 'approve' || action === 'reject';
      await credoraApi(
        isApplication
          ? `/superadmin/organization-applications/${reviewTarget}/${action}`
          : `/superadmin/organizations/${reviewTarget}/${action}`,
        { method: 'POST', body: '{}' },
        session.token,
      );
      setMessage(
        action === 'approve'
          ? 'Organization approved. Its applicant now has organization access; issuer authorization remains separate.'
          : action === 'reject'
            ? 'Organization request rejected. No organization access was granted.'
            : action === 'suspend'
              ? 'Organization suspended. Its organization-admin access is now disabled.'
              : 'Organization reactivated.',
      );
      setReviewAction(undefined);
      setReviewTarget('');
      await loadOverview(session);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Organization review could not be saved.',
      );
    } finally {
      setBusy(false);
    }
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
            Authorize issuer wallets on the registry, review organization requests, and inspect
            operational projections. Organization approval does not grant issuer authority.
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
          <Button className="button button-dark" type="button" onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect admin wallet'}
          </Button>
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
            <Label>
              Issuer wallet address
              <Input
                value={issuer}
                onChange={(event) => {
                  setIssuer(event.target.value);
                  setAuthorized(undefined);
                }}
                placeholder="0x…"
                required
                spellCheck={false}
              />
            </Label>
            <div className="form-actions">
              <Button className="button button-dark" type="submit" disabled={busy}>
                Authorize issuer
              </Button>
              <Button className="text-button" type="button" onClick={checkStatus} disabled={busy}>
                Check current status
              </Button>
              <Button className="text-button" type="button" onClick={reconcile} disabled={busy}>
                Reconcile projection
              </Button>
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
          <section className="organization-admin-queue" aria-labelledby="organization-review-title">
            <div className="panel-header">
              <div>
                <p className="panel-label">Manual approval gate</p>
                <h2 id="organization-review-title">Organization requests</h2>
              </div>
              <span className="status-badge">
                {queueLoaded ? `${applications.length} pending` : 'Queue unavailable'}
              </span>
            </div>
            <p className="form-help">
              Review each request before granting organization access. The QR only opens this
              protected review; approval does not authorize the wallet to issue on-chain.
            </p>
            {selectedApplicationId &&
            queueLoaded &&
            !applications.some((item) => item.id === selectedApplicationId) ? (
              <p className="form-help">
                This QR request is no longer pending. It may have already been reviewed.
              </p>
            ) : null}
            {!queueLoaded ? (
              <div className="organization-review-empty" role="status">
                <p>The review queue could not be loaded. Check the API connection and retry.</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    session &&
                    void loadOverview(session).catch((caught) =>
                      setError(
                        caught instanceof Error ? caught.message : 'Review queue unavailable.',
                      ),
                    )
                  }
                >
                  Retry review queue
                </Button>
              </div>
            ) : applications.length ? (
              <div className="organization-review-list">
                {applications.map((application) => (
                  <article
                    key={application.id}
                    className={`organization-review-item${selectedApplicationId === application.id ? ' is-selected' : ''}`}
                  >
                    <div>
                      <strong>{application.organizationName}</strong>
                      <span>Applicant wallet: {shortAddress(application.applicantAddress)}</span>
                      <span>Requested {new Date(application.createdAt).toLocaleDateString()}</span>
                    </div>
                    <Button
                      type="button"
                      variant={selectedApplicationId === application.id ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedApplicationId(application.id);
                        setReviewTarget(application.id);
                        setReviewAction('review');
                      }}
                    >
                      Review request
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="organization-review-empty">
                No organization requests are awaiting review.
              </p>
            )}
          </section>
          <section className="organization-admin-queue" aria-labelledby="organizations-title">
            <div className="panel-header">
              <div>
                <p className="panel-label">Approved access</p>
                <h2 id="organizations-title">Organizations</h2>
              </div>
              <span className="panel-note">Operational records · not on-chain entities</span>
            </div>
            {!queueLoaded ? (
              <p className="organization-review-empty">
                Organization records are unavailable until the review service responds.
              </p>
            ) : organizations.length ? (
              <div className="organization-review-list">
                {organizations.map((organization) => (
                  <article className="organization-review-item" key={organization.id}>
                    <div>
                      <strong>{organization.name}</strong>
                      <span>Admin wallet: {shortAddress(organization.adminAddress)}</span>
                      <span className={`state-label state-${organization.status}`}>
                        {organization.status}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant={organization.status === 'active' ? 'outline' : 'default'}
                      onClick={() => {
                        setReviewTarget(organization.id);
                        setReviewAction(
                          organization.status === 'active' ? 'suspend' : 'reactivate',
                        );
                      }}
                    >
                      {organization.status === 'active' ? 'Suspend access' : 'Reactivate access'}
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="organization-review-empty">No approved organizations yet.</p>
            )}
          </section>
        </section>
      )}
      <Dialog
        open={Boolean(reviewAction)}
        onOpenChange={(open) => !open && !busy && setReviewAction(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'review'
                ? 'Review organization request'
                : reviewAction === 'suspend'
                  ? 'Suspend organization access?'
                  : 'Reactivate organization access?'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'review'
                ? 'Check the organization name and the wallet that requested access. Approval creates an organization record and grants ORG_ADMIN to this wallet only. Issuer authorization remains separate.'
                : reviewAction === 'suspend'
                  ? 'The organization-admin wallet will lose access to organization operations. This does not revoke any on-chain issuer permission; use issuer controls separately if that wallet must stop issuing.'
                  : 'This restores the organization-admin wallet access. Registry issuer authorization is still checked independently.'}
            </DialogDescription>
          </DialogHeader>
          {applications.find((item) => item.id === reviewTarget)
            ? (() => {
                const item = applications.find((entry) => entry.id === reviewTarget)!;
                return (
                  <div className="organization-review-detail">
                    <strong>{item.organizationName}</strong>
                    <span>Self-reported website</span>
                    <code>{item.websiteUrl}</code>
                    <span>Applicant wallet</span>
                    <code>{item.applicantAddress}</code>
                    <p>
                      Verify the organization and confirm this wallet with an independent, trusted
                      source before approval.
                    </p>
                  </div>
                );
              })()
            : null}
          {organizations.find((item) => item.id === reviewTarget)
            ? (() => {
                const item = organizations.find((entry) => entry.id === reviewTarget)!;
                return (
                  <div className="organization-review-detail">
                    <strong>{item.name}</strong>
                    <code>{item.websiteUrl}</code>
                    <code>{item.adminAddress}</code>
                  </div>
                );
              })()
            : null}
          <DialogFooter>
            {reviewAction === 'review' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void decideOrganization('reject')}
                  disabled={busy}
                >
                  Reject request
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => void decideOrganization('approve')}
                  disabled={busy}
                >
                  {busy ? 'Saving…' : 'Approve organization'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant={reviewAction === 'suspend' ? 'destructive' : 'default'}
                onClick={() => void decideOrganization()}
                disabled={busy}
              >
                {busy
                  ? 'Saving…'
                  : reviewAction === 'suspend'
                    ? 'Confirm suspension'
                    : 'Confirm reactivation'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!session ? <WalletGuide /> : null}
    </main>
  );
}
