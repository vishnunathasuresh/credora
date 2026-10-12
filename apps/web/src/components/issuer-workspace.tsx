'use client';
import { WalletGuide } from './wallet-guide';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tooltip } from './ui/tooltip';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ReactQRCode, type ReactQRCodeRef } from '@lglab/react-qr-code';
import { credentialRegistryAbi, organizationCredentialRegistryAbi } from '@credora/contracts';
import { organizationIdFromApplicationId } from '@credora/credential-core';
import { createWalletClient, custom, defineChain, getAddress, isAddress, type Hex } from 'viem';
import { AlertIcon, ArrowUpRightIcon, CheckIcon } from './icons';
import { CredentialShare } from './credential-share';
import { CredentialCard } from './credential-card';
import { credoraApi, type ApiError } from '../lib/credora-api';
import {
  browserWalletProvider,
  connectWalletSession,
  forgetSession,
  storedSession,
  type WalletSession,
} from '../lib/wallet-session';

type IssuancePhase =
  | 'idle'
  | 'drafting'
  | 'uploading'
  | 'awaiting-wallet'
  | 'confirming'
  | 'review-pending'
  | 'confirmed'
  | 'error';

type IssuanceRow = {
  id: string;
  learner: string;
  skill_name: string;
  skill_level: string;
  issue_date: string;
  credential_hash?: string;
  transaction_hash?: string;
  review_status?: 'pending' | 'approved' | 'rejected';
  batch_id?: string | null;
  state: string;
};

type IssuanceResponse = {
  id: string;
  state: string;
  credentialHash?: string;
  uri?: string;
  transactionHash?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  blockNumber?: string;
  imageUri?: string;
};

type OrganizationOverview = {
  issuanceCounts: Record<string, number>;
  organization: { id: string; name: string } | null;
  issuerAuthorization: 'authorized' | 'not-authorized' | 'unavailable';
  organizationAdmin: boolean;
  chainOrganizationStatus: 'active' | 'suspended' | 'not-activated';
  operationalStatus: 'active' | 'suspended';
  projection: string;
  projectionNote: string;
};
type OrganizationIssuer = { address: string; active: number; updatedAt: string };
type OrganizationMember = {
  address: string;
  role: string;
  status: 'active' | 'removed';
  updatedAt: string;
};
type OrganizationTemplate = {
  id: string;
  name: string;
  skillName: string;
  skillLevel: string;
  description: string | null;
  version: number;
  active: number;
};
type OrganizationReviewItem = {
  id: string;
  batchId: string | null;
  learner: string;
  skillName: string;
  skillLevel: string;
  issueDate: string;
  metadataUri: string | null;
  credentialHash: string | null;
  reviewStatus: string;
  createdAt: string;
  metadata?: { description?: string; imageUri?: string } | null;
  metadataUnavailable?: boolean;
};

type OrganizationApplication = {
  id: string;
  organizationName: string;
  legalName: string;
  websiteUrl: string;
  evidenceUrl: string;
  registrationReference: string;
  logoUrl: string | null;
  applicantAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const contractAddress = process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS;
const organizationContractAddress =
  process.env.NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS;
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

const initialForm = {
  learnerAddress: '',
  skillName: '',
  skillLevel: 'Advanced',
  issueDate: new Date().toISOString().slice(0, 10),
  description: '',
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Image read failed.'));
    reader.readAsDataURL(file);
  });
}

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
  organization?: { id: string },
) {
  const address = organization ? organizationContractAddress : contractAddress;
  if (!address)
    throw new Error(
      `Set NEXT_PUBLIC_${organization ? 'ORGANIZATION_' : ''}CREDENTIAL_REGISTRY_ADDRESS before issuing on-chain.`,
    );
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
    address: getAddress(address),
    abi: organization ? organizationCredentialRegistryAbi : credentialRegistryAbi,
    functionName: 'issueCredential',
    args: organization
      ? [
          organizationIdFromApplicationId(organization.id),
          credentialHash as Hex,
          getAddress(learner),
          uri,
        ]
      : [credentialHash as Hex, getAddress(learner), uri],
  });
}

export function IssuerWorkspace({ audience = 'issuer' }: { audience?: 'issuer' | 'organization' }) {
  const [session, setSession] = useState<WalletSession>();
  const [issuances, setIssuances] = useState<IssuanceRow[]>([]);
  const [organizationOverview, setOrganizationOverview] = useState<OrganizationOverview>();
  const [organizationIssuers, setOrganizationIssuers] = useState<OrganizationIssuer[]>([]);
  const [issuerWallet, setIssuerWallet] = useState('');
  const [rotationWallets, setRotationWallets] = useState<Record<string, string>>({});
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [memberWallet, setMemberWallet] = useState('');
  const [issuerBusy, setIssuerBusy] = useState(false);
  const [organizationTemplates, setOrganizationTemplates] = useState<OrganizationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDraft, setTemplateDraft] = useState({
    skillName: '',
    skillLevel: 'Advanced',
    description: '',
  });
  const [templateBusy, setTemplateBusy] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [reviewers, setReviewers] = useState<{ address: string; active: number }[]>([]);
  const [reviewerWallet, setReviewerWallet] = useState('');
  const [reviewQueue, setReviewQueue] = useState<OrganizationReviewItem[]>([]);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [bulkRecipients, setBulkRecipients] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [organizationApplication, setOrganizationApplication] =
    useState<OrganizationApplication | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationLegalName, setOrganizationLegalName] = useState('');
  const [organizationWebsite, setOrganizationWebsite] = useState('');
  const [organizationEvidenceUrl, setOrganizationEvidenceUrl] = useState('');
  const [organizationRegistrationReference, setOrganizationRegistrationReference] = useState('');
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState('');
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationReviewUrl, setApplicationReviewUrl] = useState('');
  const applicationQrRef = useRef<ReactQRCodeRef>(null);
  const [form, setForm] = useState(initialForm);
  const [credentialImage, setCredentialImage] = useState<File | null>(null);
  const [credentialImagePreview, setCredentialImagePreview] = useState('');
  const [phase, setPhase] = useState<IssuancePhase>('idle');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
  const hasWorkspaceAccess =
    audience === 'organization' ? isOrgAdmin || Boolean(organizationOverview?.organization) : true;
  const busy = !['idle', 'confirmed', 'error'].includes(phase);

  useEffect(() => {
    return () => {
      if (credentialImagePreview.startsWith('blob:')) URL.revokeObjectURL(credentialImagePreview);
    };
  }, [credentialImagePreview]);

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
      let mine: { application: OrganizationApplication | null } | undefined;
      if (audience === 'organization') {
        mine = await credoraApi<{ application: OrganizationApplication | null }>(
          '/org/applications/mine',
          {},
          current.token,
        );
        setOrganizationApplication(mine.application);
      }
      if (audience === 'organization') {
        const linkedOrganizationId =
          mine?.application?.status === 'approved'
            ? mine.application.id
            : new URLSearchParams(window.location.search).get('organizationId');
        if (!linkedOrganizationId) {
          setOrganizationOverview(undefined);
          setIssuances([]);
          return;
        }
        const overview = await credoraApi<OrganizationOverview>(
          `/org/overview?organizationId=${encodeURIComponent(linkedOrganizationId)}`,
          {},
          current.token,
        );
        if (!overview.organization) throw new Error('Organization workspace is unavailable.');
        setOrganizationOverview(overview);
        if (overview.organizationAdmin || overview.issuerAuthorization === 'authorized') {
          const list = await credoraApi<{ items: IssuanceRow[] }>(
            `/issuances?organizationId=${encodeURIComponent(overview.organization.id)}`,
            {},
            current.token,
          );
          setIssuances(list.items);
        } else setIssuances([]);
        try {
          const queue = await credoraApi<{ items: OrganizationReviewItem[] }>(
            `/org/issuances/review-queue?organizationId=${encodeURIComponent(overview.organization.id)}`,
            {},
            current.token,
          );
          setReviewQueue(queue.items);
        } catch {
          setReviewQueue([]);
        }
        if (overview.organizationAdmin) {
          const issuerList = await credoraApi<{ issuers: OrganizationIssuer[] }>(
            `/org/issuers?organizationId=${encodeURIComponent(overview.organization.id)}`,
            {},
            current.token,
          );
          setOrganizationIssuers(issuerList.issuers);
          const team = await credoraApi<{ members: OrganizationMember[] }>(
            `/org/team?organizationId=${encodeURIComponent(overview.organization.id)}`,
            {},
            current.token,
          );
          setOrganizationMembers(team.members);
          const templates = await credoraApi<{ items: OrganizationTemplate[] }>(
            `/org/templates?organizationId=${encodeURIComponent(overview.organization.id)}`,
            {},
            current.token,
          );
          setOrganizationTemplates(templates.items);
          const policy = await credoraApi<{
            approvalRequired: boolean;
            reviewers: { address: string; active: number }[];
          }>(
            `/org/policy?organizationId=${encodeURIComponent(overview.organization.id)}`,
            {},
            current.token,
          );
          setApprovalRequired(policy.approvalRequired);
          setReviewers(policy.reviewers);
        } else {
          setOrganizationIssuers([]);
          setOrganizationMembers([]);
          setOrganizationTemplates([]);
          setReviewers([]);
        }
        return;
      }
      if (!refreshed.roles.includes('ISSUER')) {
        setIssuances([]);
        return;
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
          body: JSON.stringify({
            organizationName,
            legalName: organizationLegalName,
            websiteUrl: organizationWebsite,
            evidenceUrl: organizationEvidenceUrl,
            registrationReference: organizationRegistrationReference,
            logoUrl: organizationLogoUrl,
          }),
        },
        session.token,
      );
      setOrganizationApplication(application);
      setOrganizationName('');
      setOrganizationLegalName('');
      setOrganizationWebsite('');
      setOrganizationEvidenceUrl('');
      setOrganizationRegistrationReference('');
      setOrganizationLogoUrl('');
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setApplicationBusy(false);
    }
  }

  async function changeOrganizationIssuer(issuerAddress: string, authorized: boolean) {
    if (!session || !organizationOverview?.organization || !isAddress(issuerAddress)) return;
    if (!organizationContractAddress) {
      setError(
        'Organization issuer management is unavailable because the registry is not configured.',
      );
      return;
    }
    setIssuerBusy(true);
    setError('');
    setMessage('');
    try {
      const provider = browserWalletProvider();
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts[0] || getAddress(accounts[0]) !== session.address)
        throw new Error('Switch the browser wallet back to the organization admin account.');
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
      const normalizedIssuer = getAddress(issuerAddress);
      const transactionHash = await walletClient.writeContract({
        address: getAddress(organizationContractAddress),
        abi: organizationCredentialRegistryAbi,
        functionName: 'setIssuerAuthorization',
        args: [
          organizationIdFromApplicationId(organizationOverview.organization.id),
          normalizedIssuer,
          authorized,
        ],
      });
      await credoraApi(
        '/org/issuer-authorizations/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationOverview.organization.id,
            issuer: normalizedIssuer,
            authorized,
            transactionHash,
          }),
        },
        session.token,
      );
      setIssuerWallet('');
      setMessage(
        authorized
          ? `${shortAddress(normalizedIssuer)} can now issue for this organization.`
          : `${shortAddress(normalizedIssuer)} can no longer issue for this organization.`,
      );
      await loadWorkspace(session);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setIssuerBusy(false);
    }
  }

  async function rotateOrganizationIssuer(oldIssuer: string, newIssuer: string) {
    if (!session || !organizationOverview?.organization || !isAddress(newIssuer)) {
      setError('Enter a valid replacement issuer wallet.');
      return;
    }
    if (!organizationContractAddress) {
      setError(
        'Organization issuer management is unavailable because the registry is not configured.',
      );
      return;
    }
    setIssuerBusy(true);
    setError('');
    try {
      const provider = browserWalletProvider();
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts[0] || getAddress(accounts[0]) !== session.address)
        throw new Error('Switch the browser wallet back to the organization admin account.');
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
      const replacement = getAddress(newIssuer);
      const recoveryKey = `credora:key-rotation:${organizationOverview.organization.id}:${oldIssuer.toLowerCase()}:${replacement.toLowerCase()}`;
      const storedTransaction = window.sessionStorage.getItem(recoveryKey);
      const transactionHash = storedTransaction
        ? (storedTransaction as Hex)
        : await walletClient.writeContract({
            address: getAddress(organizationContractAddress),
            abi: organizationCredentialRegistryAbi,
            functionName: 'rotateIssuerAuthorization',
            args: [
              organizationIdFromApplicationId(organizationOverview.organization.id),
              getAddress(oldIssuer),
              replacement,
            ],
          });
      if (!storedTransaction) window.sessionStorage.setItem(recoveryKey, transactionHash);
      await credoraApi(
        '/org/issuer-authorizations/rotate-confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationOverview.organization.id,
            oldIssuer: getAddress(oldIssuer),
            newIssuer: replacement,
            transactionHash,
          }),
        },
        session.token,
      );
      window.sessionStorage.removeItem(recoveryKey);
      setRotationWallets((current) => ({ ...current, [oldIssuer]: '' }));
      setMessage(`Signing authority rotated to ${shortAddress(replacement)}.`);
      await loadWorkspace(session);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setIssuerBusy(false);
    }
  }

  async function changeOrganizationAdmin(accountAddress: string, authorized: boolean) {
    if (!session || !organizationOverview?.organization || !isAddress(accountAddress)) return;
    if (!organizationContractAddress) {
      setError(
        'Organization team management is unavailable because the registry is not configured.',
      );
      return;
    }
    setIssuerBusy(true);
    setError('');
    try {
      const provider = browserWalletProvider();
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts[0] || getAddress(accounts[0]) !== session.address)
        throw new Error('Switch the browser wallet back to the organization admin account.');
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
      const normalizedAccount = getAddress(accountAddress);
      const transactionHash = await walletClient.writeContract({
        address: getAddress(organizationContractAddress),
        abi: organizationCredentialRegistryAbi,
        functionName: 'setOrganizationAdmin',
        args: [
          organizationIdFromApplicationId(organizationOverview.organization.id),
          normalizedAccount,
          authorized,
        ],
      });
      await credoraApi(
        '/org/team/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationOverview.organization.id,
            account: normalizedAccount,
            authorized,
            transactionHash,
          }),
        },
        session.token,
      );
      setMemberWallet('');
      setMessage(
        authorized
          ? `${shortAddress(normalizedAccount)} is now an organization admin.`
          : 'Organization admin access removed.',
      );
      await loadWorkspace(session);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setIssuerBusy(false);
    }
  }

  async function createOrganizationTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !organizationOverview?.organization) return;
    setTemplateBusy(true);
    setError('');
    try {
      await credoraApi(
        '/org/templates',
        {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationOverview.organization.id,
            name: templateName,
            ...templateDraft,
          }),
        },
        session.token,
      );
      setTemplateName('');
      await loadWorkspace(session);
      setMessage('Template saved as a new version. Previous versions remain available in history.');
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setTemplateBusy(false);
    }
  }

  async function saveOrganizationPolicy() {
    if (!session || !organizationOverview?.organization) return;
    if (approvalRequired && !reviewers.some((reviewer) => reviewer.active)) {
      setError('Add at least one reviewer before requiring internal approval.');
      return;
    }
    setPolicyBusy(true);
    setError('');
    try {
      await credoraApi(
        '/org/policy',
        {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationOverview.organization.id,
            approvalRequired,
            reviewers: reviewers
              .filter((reviewer) => reviewer.active)
              .map((reviewer) => reviewer.address),
          }),
        },
        session.token,
      );
      setMessage(
        approvalRequired
          ? 'Internal review is enabled. Designated reviewers must approve before signing.'
          : 'Issuance can now proceed directly from an authorized issuer wallet.',
      );
      await loadWorkspace(session);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setPolicyBusy(false);
    }
  }

  async function reviewOrganizationIssuance(item: OrganizationReviewItem, approved: boolean) {
    if (!session || !organizationOverview?.organization) return;
    setPolicyBusy(true);
    setError('');
    try {
      await credoraApi(
        '/org/issuances/review',
        {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationOverview.organization.id,
            ...(item.batchId ? { batchId: item.batchId } : { issuanceId: item.id }),
            approved,
          }),
        },
        session.token,
      );
      setMessage(
        approved ? 'Issuance approved. Its issuer can now sign on-chain.' : 'Issuance rejected.',
      );
      await loadWorkspace(session);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setPolicyBusy(false);
    }
  }

  async function issueBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !organizationOverview?.organization || !isIssuer) return;
    const recipients = bulkRecipients
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (recipients.length < 2 || recipients.length > 25) {
      setError('Bulk issuance supports 2 to 25 wallets per transaction.');
      return;
    }
    if (recipients.some((value) => !isAddress(value))) {
      setError('Every recipient must be a valid wallet address.');
      return;
    }
    if (
      new Set(recipients.map((value) => getAddress(value).toLowerCase())).size !== recipients.length
    ) {
      setError('Remove duplicate recipient wallets before issuing.');
      return;
    }
    if (!organizationContractAddress) {
      setError('Organization credential registry is not configured.');
      return;
    }
    const fingerprint = JSON.stringify({
      organizationId: organizationOverview.organization.id,
      recipients: recipients.map((value) => getAddress(value).toLowerCase()),
      skillName: form.skillName,
      skillLevel: form.skillLevel,
      issueDate: form.issueDate,
      description: form.description,
    });
    const recoveryKey = `credora:bulk:${organizationOverview.organization.id}:${encodeURIComponent(fingerprint)}`;
    const recovery = JSON.parse(window.sessionStorage.getItem(recoveryKey) ?? '{}') as {
      idempotencyKey?: string;
      transactionHash?: `0x${string}`;
    };
    recovery.idempotencyKey ??= crypto.randomUUID();
    window.sessionStorage.setItem(recoveryKey, JSON.stringify(recovery));
    setBulkBusy(true);
    setError('');
    setMessage('');
    try {
      const batch = await credoraApi<{
        id: string;
        reviewStatus: string;
        items: { id: string; learner: string }[];
      }>(
        '/issuances/bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationOverview.organization.id,
            idempotencyKey: recovery.idempotencyKey,
            recipients: recipients.map((value) => getAddress(value)),
            skillName: form.skillName,
            skillLevel: form.skillLevel,
            issueDate: new Date(`${form.issueDate}T00:00:00.000Z`).toISOString(),
          }),
        },
        session.token,
      );
      const prepared = await Promise.all(
        batch.items.map(async (item) => {
          const metadata = await credoraApi<IssuanceResponse>(
            `/issuances/${item.id}/metadata`,
            {
              method: 'POST',
              body: JSON.stringify({ description: form.description || undefined }),
            },
            session.token,
          );
          if (!metadata.credentialHash || !metadata.uri)
            throw new Error('Metadata was not prepared for every batch recipient.');
          return {
            id: item.id,
            learner: getAddress(item.learner),
            credentialHash: metadata.credentialHash as Hex,
            uri: metadata.uri,
          };
        }),
      );
      if (batch.reviewStatus === 'pending') {
        setMessage(
          'Batch payloads prepared. A designated reviewer must approve them before registry signing.',
        );
        await loadWorkspace(session);
        return;
      }
      const provider = browserWalletProvider();
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts[0] || getAddress(accounts[0]) !== session.address)
        throw new Error('Switch the browser wallet back to the authorized organization issuer.');
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
      const transactionHash =
        recovery.transactionHash ??
        (await walletClient.writeContract({
          address: getAddress(organizationContractAddress),
          abi: organizationCredentialRegistryAbi,
          functionName: 'issueCredentials',
          args: [
            organizationIdFromApplicationId(organizationOverview.organization.id),
            prepared.map((item) => item.credentialHash),
            prepared.map((item) => item.learner),
            prepared.map((item) => item.uri),
          ],
        }));
      if (!recovery.transactionHash) {
        recovery.transactionHash = transactionHash;
        window.sessionStorage.setItem(recoveryKey, JSON.stringify(recovery));
      }
      const confirmed = await credoraApi<{ state: string; credentialHashes: string[] }>(
        '/issuances/bulk/confirm',
        {
          method: 'POST',
          body: JSON.stringify({ batchId: batch.id, transactionHash }),
        },
        session.token,
      );
      setBulkRecipients('');
      window.sessionStorage.removeItem(recoveryKey);
      setMessage(
        `${confirmed.credentialHashes.length} credentials confirmed in one registry transaction.`,
      );
      await loadWorkspace(session);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBulkBusy(false);
    }
  }

  async function resumeOrganizationIssuance(issuance: IssuanceRow) {
    if (!session || !organizationOverview?.organization || issuance.review_status !== 'approved')
      return;
    setError('');
    setMessage('');
    setPhase('awaiting-wallet');
    try {
      const prepared = await credoraApi<{
        metadata_uri?: string;
        credential_hash?: string;
        learner: string;
        skill_name: string;
        skill_level: string;
        issue_date: string;
      }>(`/issuances/${issuance.id}`, {}, session.token);
      if (!prepared.metadata_uri || !prepared.credential_hash)
        throw new Error('This issuance has not finished preparing its metadata.');
      const transactionHash = await issueOnChain(
        session,
        prepared.credential_hash,
        prepared.learner,
        prepared.metadata_uri,
        organizationOverview.organization,
      );
      setPhase('confirming');
      const confirmed = await credoraApi<IssuanceResponse>(
        `/issuances/${issuance.id}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({ transactionHash, credentialHash: prepared.credential_hash }),
        },
        session.token,
      );
      setForm((current) => ({
        ...current,
        learnerAddress: prepared.learner,
        skillName: prepared.skill_name,
        skillLevel: prepared.skill_level,
        issueDate: prepared.issue_date.slice(0, 10),
      }));
      setResult({ ...confirmed, credentialHash: prepared.credential_hash, transactionHash });
      setPhase('confirmed');
      setMessage('Credential confirmed on the organization registry.');
      await loadWorkspace(session);
    } catch (caught) {
      setError(friendlyError(caught));
      setPhase('error');
    }
  }

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !isIssuer) return;
    setError('');
    setMessage('');
    setResult(undefined);
    try {
      if (!isAddress(form.learnerAddress)) throw new Error('Enter a valid learner wallet address.');
      setPhase('drafting');
      const draft = await credoraApi<IssuanceResponse>(
        '/issuances',
        {
          method: 'POST',
          body: JSON.stringify({
            ...(audience === 'organization' && organizationOverview?.organization
              ? { organizationId: organizationOverview.organization.id }
              : {}),
            learnerAddress: getAddress(form.learnerAddress),
            skillName: form.skillName,
            skillLevel: form.skillLevel,
            issueDate: new Date(`${form.issueDate}T00:00:00.000Z`).toISOString(),
          }),
        },
        session.token,
      );
      setPhase('uploading');
      let imageUri: string | undefined;
      if (credentialImage) {
        const image = await credoraApi<{ uri: string }>(
          `/issuances/${draft.id}/image`,
          {
            method: 'POST',
            body: JSON.stringify({ dataUrl: await readFileAsDataUrl(credentialImage) }),
          },
          session.token,
        );
        imageUri = image.uri;
      }
      const metadata = await credoraApi<IssuanceResponse>(
        `/issuances/${draft.id}/metadata`,
        {
          method: 'POST',
          body: JSON.stringify({ description: form.description || undefined, imageUri }),
        },
        session.token,
      );
      if (!metadata.credentialHash || !metadata.uri)
        throw new Error('The metadata upload did not return a proof reference.');
      setResult({ ...metadata, imageUri });
      if (metadata.reviewStatus === 'pending') {
        setPhase('review-pending');
        setMessage(
          'Credential prepared. A designated organization reviewer must approve this exact payload before it can be signed.',
        );
        await loadWorkspace(session);
        return;
      }
      setPhase('awaiting-wallet');
      const transactionHash = await issueOnChain(
        session,
        metadata.credentialHash,
        getAddress(form.learnerAddress),
        metadata.uri,
        audience === 'organization' ? (organizationOverview?.organization ?? undefined) : undefined,
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
      setResult({ ...metadata, ...confirmed, imageUri, transactionHash });
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
      case 'review-pending':
        return 'Prepared payload is waiting for organization review.';
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
                Submit your organization details and verification evidence. After review, the
                superadmin activates your organization and your connected wallet can issue
                immediately.
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
                  Registered legal name
                  <Input
                    value={organizationLegalName}
                    onChange={(event) => setOrganizationLegalName(event.target.value)}
                    placeholder="Name on official registration"
                    minLength={2}
                    maxLength={160}
                    required
                  />
                </Label>
                <Label>
                  Registration reference
                  <Input
                    value={organizationRegistrationReference}
                    onChange={(event) => setOrganizationRegistrationReference(event.target.value)}
                    placeholder="Registration or accreditation number"
                    maxLength={160}
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
                <Label>
                  Verification evidence URL
                  <Input
                    type="url"
                    inputMode="url"
                    value={organizationEvidenceUrl}
                    onChange={(event) => setOrganizationEvidenceUrl(event.target.value)}
                    placeholder="https://registry.example.org/organization/…"
                    maxLength={2048}
                    required
                  />
                </Label>
                <Label>
                  Organization logo URL (optional)
                  <Input
                    type="url"
                    inputMode="url"
                    value={organizationLogoUrl}
                    onChange={(event) => setOrganizationLogoUrl(event.target.value)}
                    placeholder="https://example.org/assets/logo.png"
                    maxLength={2048}
                  />
                </Label>
                <p className="form-help">
                  The website and logo are self-reported. The logo must come from the same HTTPS
                  site. A superadmin checks them independently before approving. Branding is for
                  display and is not part of the credential proof.
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
              <p className="form-help" role="status">
                Registry authority: <strong>{organizationOverview.chainOrganizationStatus}</strong>
                {' · '}Your signing wallet:{' '}
                <strong>{organizationOverview.issuerAuthorization}</strong>
              </p>
            </section>
          ) : null}
          {audience === 'organization' && organizationOverview?.organizationAdmin ? (
            <section className="workspace-panel" aria-labelledby="organization-team-title">
              <div className="panel-header">
                <div>
                  <p className="panel-label">Organization settings</p>
                  <h2 id="organization-team-title">Administrators</h2>
                </div>
              </div>
              <p className="form-help">
                Admin roles are enforced by the organization registry. Organization admins can
                manage issuer wallets, templates, team access, and review policy.
              </p>
              <form
                className="workspace-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void changeOrganizationAdmin(memberWallet, true);
                }}
              >
                <Label>
                  Add organization admin
                  <Input
                    value={memberWallet}
                    onChange={(event) => setMemberWallet(event.target.value)}
                    placeholder="0x…"
                    required
                    spellCheck={false}
                  />
                </Label>
                <Button type="submit" disabled={issuerBusy || !isAddress(memberWallet)}>
                  {issuerBusy ? 'Waiting for registry…' : 'Add admin'}
                </Button>
              </form>
              <div className="organization-review-list">
                {organizationMembers.map((member) => (
                  <article className="organization-review-item" key={member.address}>
                    <div>
                      <strong>{shortAddress(member.address)}</strong>
                      <span>
                        {member.role} · {member.status}
                      </span>
                    </div>
                    {member.status === 'active' && member.role !== 'owner' ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          issuerBusy ||
                          member.address.toLowerCase() === session?.address.toLowerCase()
                        }
                        onClick={() => void changeOrganizationAdmin(member.address, false)}
                      >
                        Remove admin
                      </Button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {audience === 'organization' && organizationOverview?.organizationAdmin ? (
            <section className="workspace-panel" aria-labelledby="organization-policy-title">
              <div className="panel-header">
                <div>
                  <p className="panel-label">Governance policy</p>
                  <h2 id="organization-policy-title">Issuance review</h2>
                </div>
              </div>
              <Label className="organization-policy-toggle">
                <input
                  type="checkbox"
                  checked={approvalRequired}
                  onChange={(event) => setApprovalRequired(event.target.checked)}
                />
                Require internal reviewer approval before an issuer can sign
              </Label>
              <div className="workspace-form">
                <Label>
                  Add reviewer wallet
                  <Input
                    value={reviewerWallet}
                    onChange={(event) => setReviewerWallet(event.target.value)}
                    placeholder="0x…"
                    spellCheck={false}
                  />
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isAddress(reviewerWallet)}
                  onClick={() => {
                    const address = getAddress(reviewerWallet);
                    if (
                      !reviewers.some(
                        (item) => item.address.toLowerCase() === address.toLowerCase(),
                      )
                    )
                      setReviewers((current) => [...current, { address, active: 1 }]);
                    setReviewerWallet('');
                  }}
                >
                  Add reviewer
                </Button>
              </div>
              <div className="organization-review-list">
                {reviewers.map((reviewer) => (
                  <article className="organization-review-item" key={reviewer.address}>
                    <div>
                      <strong>{shortAddress(reviewer.address)}</strong>
                      <span>{reviewer.active ? 'Can review issuance' : 'Reviewer removed'}</span>
                    </div>
                    {reviewer.active ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setReviewers((current) =>
                            current.map((item) =>
                              item.address === reviewer.address ? { ...item, active: 0 } : item,
                            ),
                          )
                        }
                      >
                        Remove reviewer
                      </Button>
                    ) : null}
                  </article>
                ))}
              </div>
              <Button
                type="button"
                onClick={() => void saveOrganizationPolicy()}
                disabled={policyBusy}
              >
                {policyBusy ? 'Saving policy…' : 'Save issuance policy'}
              </Button>
            </section>
          ) : null}
          {audience === 'organization' && reviewQueue.length ? (
            <section className="workspace-panel" aria-labelledby="issuance-review-queue-title">
              <div className="panel-header">
                <div>
                  <p className="panel-label">Organization governance</p>
                  <h2 id="issuance-review-queue-title">Awaiting review</h2>
                </div>
                <span className="panel-note">{reviewQueue.length} prepared item(s)</span>
              </div>
              <div className="organization-review-list">
                {reviewQueue.map((item) => (
                  <article className="organization-review-item" key={item.id}>
                    <div>
                      <strong>
                        {item.skillName} · {item.skillLevel}
                      </strong>
                      <span>
                        Recipient {shortAddress(item.learner)} ·{' '}
                        {new Date(item.issueDate).toLocaleDateString()}
                      </span>
                      <span>
                        {item.batchId ? 'Part of a batch' : 'Single credential'} · metadata{' '}
                        {item.metadataUri ? 'prepared' : 'pending'}
                      </span>
                      {item.metadata?.description ? <span>{item.metadata.description}</span> : null}
                      {item.metadata?.imageUri ? (
                        <a
                          className="text-link"
                          href={item.metadata.imageUri}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Review attached public image
                        </a>
                      ) : null}
                      {item.metadataUnavailable ? (
                        <span>Credential metadata is temporarily unavailable.</span>
                      ) : null}
                    </div>
                    <div className="organization-review-actions">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={policyBusy}
                        onClick={() => void reviewOrganizationIssuance(item, false)}
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        disabled={policyBusy || !item.metadataUri || !item.credentialHash}
                        onClick={() => void reviewOrganizationIssuance(item, true)}
                      >
                        Approve exact payload
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {audience === 'organization' && organizationOverview?.organizationAdmin ? (
            <section className="workspace-panel" aria-labelledby="organization-templates-title">
              <div className="panel-header">
                <div>
                  <p className="panel-label">Organization settings</p>
                  <h2 id="organization-templates-title">Credential templates</h2>
                </div>
              </div>
              <form className="workspace-form" onSubmit={createOrganizationTemplate}>
                <Label>
                  Template name
                  <Input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Course completion"
                    maxLength={100}
                    required
                  />
                </Label>
                <Label>
                  Credential title
                  <Input
                    value={templateDraft.skillName}
                    onChange={(event) =>
                      setTemplateDraft((draft) => ({ ...draft, skillName: event.target.value }))
                    }
                    placeholder="Systems thinking"
                    maxLength={160}
                    required
                  />
                </Label>
                <div className="form-two-column">
                  <Label>
                    Default level
                    <NativeSelect
                      value={templateDraft.skillLevel}
                      onChange={(event) =>
                        setTemplateDraft((draft) => ({ ...draft, skillLevel: event.target.value }))
                      }
                    >
                      <NativeSelectOption>Foundational</NativeSelectOption>
                      <NativeSelectOption>Intermediate</NativeSelectOption>
                      <NativeSelectOption>Advanced</NativeSelectOption>
                      <NativeSelectOption>Expert</NativeSelectOption>
                    </NativeSelect>
                  </Label>
                  <Label>
                    Default public description
                    <Input
                      value={templateDraft.description}
                      onChange={(event) =>
                        setTemplateDraft((draft) => ({ ...draft, description: event.target.value }))
                      }
                      maxLength={2000}
                    />
                  </Label>
                </div>
                <Button type="submit" disabled={templateBusy}>
                  {templateBusy ? 'Saving version…' : 'Save template version'}
                </Button>
              </form>
              <div className="organization-review-list">
                {organizationTemplates.map((template) => (
                  <article className="organization-review-item" key={template.id}>
                    <div>
                      <strong>
                        {template.name} · v{template.version}
                      </strong>
                      <span>
                        {template.skillName} · {template.skillLevel}
                      </span>
                      <span>{template.active ? 'Current version' : 'Previous version'}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {audience === 'organization' && organizationOverview?.organizationAdmin ? (
            <section className="workspace-panel" aria-labelledby="organization-issuers-title">
              <div className="panel-header">
                <div>
                  <p className="panel-label">Organization settings</p>
                  <h2 id="organization-issuers-title">Issuer wallets</h2>
                </div>
              </div>
              <p className="form-help">
                Approved here by your organization admin and recorded in the registry. Issuer access
                is scoped to this organization.
              </p>
              <form
                className="workspace-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void changeOrganizationIssuer(issuerWallet, true);
                }}
              >
                <Label>
                  Add issuer wallet
                  <Input
                    value={issuerWallet}
                    onChange={(event) => setIssuerWallet(event.target.value)}
                    placeholder="0x…"
                    required
                    spellCheck={false}
                  />
                </Label>
                <Button type="submit" disabled={issuerBusy || !isAddress(issuerWallet)}>
                  {issuerBusy ? 'Waiting for registry…' : 'Authorize organization issuer'}
                </Button>
              </form>
              <div className="organization-review-list">
                {organizationIssuers.map((item) => (
                  <article className="organization-review-item" key={item.address}>
                    <div>
                      <strong>{shortAddress(item.address)}</strong>
                      <span>{item.active ? 'Can issue credentials' : 'Issuer access removed'}</span>
                    </div>
                    {item.active ? (
                      <div className="organization-issuer-actions">
                        <Input
                          aria-label={`Replacement wallet for ${shortAddress(item.address)}`}
                          value={rotationWallets[item.address] ?? ''}
                          onChange={(event) =>
                            setRotationWallets((current) => ({
                              ...current,
                              [item.address]: event.target.value,
                            }))
                          }
                          placeholder="Replacement wallet"
                          spellCheck={false}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={issuerBusy || !isAddress(rotationWallets[item.address] ?? '')}
                          onClick={() =>
                            void rotateOrganizationIssuer(
                              item.address,
                              rotationWallets[item.address] ?? '',
                            )
                          }
                        >
                          Rotate key
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={
                            issuerBusy ||
                            item.address.toLowerCase() === session?.address.toLowerCase()
                          }
                          onClick={() => void changeOrganizationIssuer(item.address, false)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {message ? (
            <p className="form-help" role="status">
              {message}
            </p>
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
                    : audience === 'organization'
                      ? 'This wallet has no issuer authority for this organization. Ask an organization admin to add it.'
                      : 'This wallet is not authorized by the registry to issue credentials.'}
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
              ) : phase === 'review-pending' ? (
                <div className="empty-state" role="status">
                  <strong>Prepared for review</strong>
                  <span>
                    This payload is frozen for review. No registry transaction has been sent yet.
                    After an assigned reviewer approves it, refresh this workspace and continue the
                    issuance from the prepared credential.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => session && void loadWorkspace(session)}
                  >
                    Refresh review status
                  </Button>
                </div>
              ) : (
                <form className="workspace-form" onSubmit={submit} aria-busy={busy}>
                  {audience === 'organization' &&
                  organizationTemplates.some((item) => item.active) ? (
                    <Label>
                      Start from a template
                      <NativeSelect
                        value={selectedTemplateId}
                        onChange={(event) => {
                          const id = event.target.value;
                          setSelectedTemplateId(id);
                          const selected = organizationTemplates.find((item) => item.id === id);
                          if (selected)
                            setForm((current) => ({
                              ...current,
                              skillName: selected.skillName,
                              skillLevel: selected.skillLevel,
                              description: selected.description ?? '',
                            }));
                        }}
                      >
                        <NativeSelectOption value="">Choose a template</NativeSelectOption>
                        {organizationTemplates
                          .filter((item) => item.active)
                          .map((template) => (
                            <NativeSelectOption key={template.id} value={template.id}>
                              {template.name} · v{template.version}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    </Label>
                  ) : null}
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
                  <div className="credential-image-field">
                    <div className="credential-image-label">
                      <Label htmlFor="credential-image">
                        Credential image <span className="field-optional">Optional</span>
                      </Label>
                      <Tooltip label="About credential images">
                        This image is public and can be viewed by anyone who opens the credential
                        record.
                      </Tooltip>
                    </div>
                    <p className="form-help">
                      Attach a certificate scan or project image. PNG, JPG, or WebP up to 5 MB.
                    </p>
                    <Input
                      id="credential-image"
                      type="file"
                      disabled={busy}
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        event.currentTarget.value = '';
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setError('Choose an image smaller than 5 MB.');
                          return;
                        }
                        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                          setError('Choose a PNG, JPG, or WebP image.');
                          return;
                        }
                        setError('');
                        setCredentialImage(file);
                        setCredentialImagePreview(URL.createObjectURL(file));
                      }}
                    />
                    {credentialImagePreview ? (
                      <div className="credential-image-preview">
                        <img src={credentialImagePreview} alt="Credential attachment preview" />
                        <span>{credentialImage?.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setCredentialImage(null);
                            setCredentialImagePreview('');
                          }}
                        >
                          Remove image
                        </Button>
                      </div>
                    ) : null}
                  </div>
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
                    <CredentialCard
                      metadata={
                        audience === 'organization' && organizationOverview?.organization
                          ? {
                              schemaVersion: 3,
                              organizationId: organizationIdFromApplicationId(
                                organizationOverview.organization.id,
                              ),
                              skillName: form.skillName,
                              skillLevel: form.skillLevel,
                              issueDate: new Date(`${form.issueDate}T00:00:00.000Z`).toISOString(),
                              issuerAddress: session!.address,
                              learnerAddress: getAddress(form.learnerAddress),
                              description: form.description || undefined,
                              imageUri: result.imageUri,
                            }
                          : {
                              schemaVersion: 1,
                              skillName: form.skillName,
                              skillLevel: form.skillLevel,
                              issueDate: new Date(`${form.issueDate}T00:00:00.000Z`).toISOString(),
                              issuerAddress: session!.address,
                              learnerAddress: getAddress(form.learnerAddress),
                              description: form.description || undefined,
                              imageUri: result.imageUri,
                            }
                      }
                      credentialHash={result.credentialHash}
                      issuerProfile={null}
                      showQr
                      verified
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
                      {audience === 'organization' &&
                      issuance.review_status === 'approved' &&
                      issuance.state !== 'confirmed' &&
                      issuance.credential_hash ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void resumeOrganizationIssuance(issuance)}
                        >
                          Continue issuance
                        </Button>
                      ) : null}
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
            {audience === 'organization' && isIssuer ? (
              <section className="workspace-panel" aria-labelledby="bulk-issuance-title">
                <div className="panel-header">
                  <div>
                    <p className="panel-label">Organization issuance</p>
                    <h2 id="bulk-issuance-title">Issue to multiple holders</h2>
                  </div>
                  <span className="panel-note">One registry transaction · up to 25 recipients</span>
                </div>
                <p className="form-help">
                  Enter one learner wallet per line or separate addresses with commas. Every
                  credential uses the title, level, date, and description from the issuance form.
                </p>
                <form className="workspace-form" onSubmit={issueBulk} aria-busy={bulkBusy}>
                  <Label>
                    Learner wallet addresses
                    <Textarea
                      value={bulkRecipients}
                      onChange={(event) => setBulkRecipients(event.target.value)}
                      rows={6}
                      placeholder={'0x…\n0x…'}
                      required
                    />
                  </Label>
                  <Button type="submit" disabled={bulkBusy || !form.skillName.trim()}>
                    {bulkBusy ? 'Preparing and confirming batch…' : 'Prepare and issue batch'}
                  </Button>
                </form>
              </section>
            ) : null}
          </div>
        </>
      )}
      {!session ? <WalletGuide /> : null}
    </main>
  );
}
