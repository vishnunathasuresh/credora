import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { migrateDatabase } from './migrations.js';
import {
  buildAuthMessage,
  createNonce,
  verifyAuthSignature,
  type AuthChallenge,
} from '@credora/auth';
import {
  credentialReferenceFromHash,
  hashCredential,
  hashOrganizationCredential,
  normalizeAddress,
  normalizeIssueDate,
  organizationIdFromApplicationId,
  type CredentialMetadata,
  type OrganizationCredentialMetadata,
} from '@credora/credential-core';
import { organizationCredentialRegistryAbi } from '@credora/contracts';
import {
  createCredoraPublicClient,
  RegistryBlockchainAdapter,
  type BlockchainAdapter,
} from '@credora/blockchain';
import { CredoraError, isRecord, type OperationState, type Role } from '@credora/shared';
import { FileStorage, IpfsStorage, type MetadataStorage } from '@credora/storage';
import { decodeFunctionData, defineChain, isAddress, type Address, type Hex } from 'viem';

const port = Number(process.env.API_PORT ?? 4000);
const databasePath = process.env.API_DATABASE_PATH ?? './.data/credora.sqlite';
const maxBodyBytes = Number(process.env.API_MAX_BODY_BYTES ?? 64 * 1024);
const maxImageBodyBytes = Number(process.env.API_MAX_IMAGE_BODY_BYTES ?? 8 * 1024 * 1024);
const sessionTtlMs = Number(process.env.API_SESSION_TTL_MS ?? 24 * 60 * 60_000);
const challengeTtlMs = Number(process.env.API_CHALLENGE_TTL_MS ?? 10 * 60_000);
const cleanupIntervalMs = Number(process.env.API_CLEANUP_INTERVAL_MS ?? 15 * 60_000);
const chainSyncIntervalMs = Number(process.env.CHAIN_SYNC_INTERVAL_MS ?? 30_000);
const confirmationDepth = Number(process.env.CHAIN_CONFIRMATIONS ?? 1);
const chainStartBlock = BigInt(process.env.CHAIN_START_BLOCK ?? 0);
const chainChunkSize = BigInt(process.env.CHAIN_SYNC_CHUNK_SIZE ?? 2_000);
const chainReorgRescanBlocks = BigInt(process.env.CHAIN_REORG_RESCAN_BLOCKS ?? 12);
const rateLimitWindowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);
const rateLimitMax = Number(process.env.API_RATE_LIMIT_MAX ?? 120);
const organizationIntakeWindowMs = Number(
  process.env.API_ORG_APPLICATION_WINDOW_MS ?? 24 * 60 * 60_000,
);
const organizationIntakeMax = Number(process.env.API_ORG_APPLICATION_MAX_PER_IP ?? 5);
const organizationIntakeMaxPending = Number(process.env.API_ORG_APPLICATION_MAX_PENDING ?? 100);
const trustProxy = process.env.API_TRUST_PROXY === 'true';
const hstsEnabled = process.env.API_HSTS === 'true';
const allowedOrigins = new Set(
  (process.env.API_ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec('PRAGMA foreign_keys = ON');
migrateDatabase(database);

const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const configuredChainId = Number(process.env.CHAIN_ID ?? 31337);
const configuredRegistryAddress = process.env.CREDENTIAL_REGISTRY_ADDRESS;
const chain = defineChain({
  id: configuredChainId,
  name: `Credora local chain ${configuredChainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

const registryAddress =
  configuredRegistryAddress &&
  isAddress(configuredRegistryAddress) &&
  configuredRegistryAddress.toLowerCase() !== '0x0000000000000000000000000000000000000000'
    ? normalizeAddress(configuredRegistryAddress, 'CREDENTIAL_REGISTRY_ADDRESS')
    : undefined;

const configuredOrganizationRegistryAddress = process.env.ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS;
const organizationRegistryAddress =
  configuredOrganizationRegistryAddress &&
  isAddress(configuredOrganizationRegistryAddress) &&
  configuredOrganizationRegistryAddress.toLowerCase() !==
    '0x0000000000000000000000000000000000000000'
    ? normalizeAddress(
        configuredOrganizationRegistryAddress,
        'ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS',
      )
    : undefined;

const blockchain: BlockchainAdapter | undefined = registryAddress
  ? new RegistryBlockchainAdapter(
      { chain, rpcUrl, contractAddress: registryAddress },
      createCredoraPublicClient({ chain, rpcUrl, contractAddress: registryAddress }),
    )
  : undefined;
const organizationPublicClient = organizationRegistryAddress
  ? createCredoraPublicClient({
      chain,
      rpcUrl,
      contractAddress: organizationRegistryAddress,
    })
  : undefined;

const storage: MetadataStorage =
  process.env.IPFS_UPLOAD_URL && process.env.IPFS_GATEWAY_URL
    ? new IpfsStorage({
        uploadUrl: process.env.IPFS_UPLOAD_URL,
        gatewayBaseUrl: process.env.IPFS_GATEWAY_URL,
        uploadAuthToken: process.env.IPFS_UPLOAD_AUTH_TOKEN,
        gatewayAuthToken: process.env.IPFS_GATEWAY_AUTH_TOKEN,
        requestTimeoutMs: Number(process.env.IPFS_REQUEST_TIMEOUT_MS ?? 15_000),
      })
    : new FileStorage(process.env.API_STORAGE_PATH ?? './.data/metadata');
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };
const rateLimits = new Map<string, { startedAt: number; count: number }>();
const organizationApplicationRateLimits = new Map<string, { startedAt: number; count: number }>();
const walletShareRateLimits = new Map<string, { startedAt: number; count: number }>();
const metrics = new Map<string, number>();
const configuredSuperadminAddresses = new Set(
  (process.env.API_SUPERADMIN_ADDRESSES ?? process.env.API_ADMIN_ADDRESSES ?? '')
    .split(',')
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean),
);
const configuredOrgAdminAddresses = new Set(
  (process.env.API_ORG_ADMIN_ADDRESSES ?? '')
    .split(',')
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean),
);

function stringifyJson(value: unknown) {
  return JSON.stringify(value, (_key, nested) =>
    typeof nested === 'bigint' ? nested.toString() : nested,
  );
}

function isSqliteConstraint(error: unknown) {
  return (
    error instanceof Error &&
    String((error as Error & { code?: string }).code ?? '').startsWith('SQLITE_CONSTRAINT')
  );
}

function incrementMetric(name: string) {
  metrics.set(name, (metrics.get(name) ?? 0) + 1);
}

function originHeaders(request: IncomingMessage) {
  const origin = header(request, 'origin');
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : undefined;
  return {
    ...jsonHeaders,
    ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin } : {}),
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-share-management-token',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    ...(hstsEnabled ? { 'strict-transport-security': 'max-age=31536000' } : {}),
    vary: 'Origin',
  };
}

function send(request: IncomingMessage, response: ServerResponse, status: number, body: unknown) {
  incrementMetric(`http_responses_${status}_total`);
  response.writeHead(status, originHeaders(request));
  response.end(stringifyJson(body));
}

function fail(request: IncomingMessage, response: ServerResponse, error: unknown) {
  incrementMetric('api_errors_total');
  const normalized =
    error instanceof CredoraError
      ? error
      : new CredoraError(
          error instanceof Error ? error.message : 'Unexpected API error',
          'INTERNAL_ERROR',
        );
  if (normalized.code === 'RATE_LIMITED')
    response.setHeader('retry-after', Math.ceil(rateLimitWindowMs / 1000).toString());
  if (normalized.code === 'ORGANIZATION_INTAKE_LIMITED')
    response.setHeader('retry-after', Math.ceil(organizationIntakeWindowMs / 1000).toString());
  if (normalized.code === 'SHARE_RATE_LIMITED') response.setHeader('retry-after', '3600');
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'api_request_failed',
      method: request.method,
      path: request.url?.replace(/\/shares\/[^/?]+/g, '/shares/[redacted]'),
      code: normalized.code,
      status: normalized.status,
    }),
  );
  send(request, response, normalized.status, {
    error: normalized.code,
    message: normalized.message,
  });
}

async function bodyOf(
  request: IncomingMessage,
  maxBytes = maxBodyBytes,
): Promise<Record<string, unknown>> {
  const contentLength = Number(header(request, 'content-length') ?? 0);
  if (contentLength > maxBytes)
    throw new CredoraError('Request body is too large', 'PAYLOAD_TOO_LARGE', 413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  for (const chunk of chunks) size += chunk.length;
  if (size > maxBytes)
    throw new CredoraError('Request body is too large', 'PAYLOAD_TOO_LARGE', 413);
  if (!chunks.length) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new CredoraError('Request body must contain valid JSON', 'INVALID_BODY', 400);
  }
  if (!isRecord(parsed))
    throw new CredoraError('Request body must be an object', 'INVALID_BODY', 400);
  return parsed;
}

function imageTypeIsValid(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/png')
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    );
  if (contentType === 'image/jpeg')
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (contentType === 'image/webp')
    return (
      bytes.length >= 12 &&
      Buffer.from(bytes.slice(0, 4)).toString() === 'RIFF' &&
      Buffer.from(bytes.slice(8, 12)).toString() === 'WEBP'
    );
  return false;
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function currentSession(request: IncomingMessage) {
  const value = header(request, 'authorization');
  if (!value?.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length);
  const row = database.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as
    { token: string; address: string; roles: string; expires_at: string } | undefined;
  if (!row || Date.parse(row.expires_at) <= Date.now()) return undefined;
  const address = normalizeAddress(row.address, 'session.address');
  const roles = JSON.parse(row.roles) as Role[];
  const organization = database
    .prepare("SELECT id FROM organizations WHERE admin_address = ? AND status = 'active'")
    .get(address) as { id: string } | undefined;
  if (organization && !roles.includes('ORG_ADMIN')) roles.unshift('ORG_ADMIN');
  else if (!organization && !configuredOrgAdminAddresses.has(address.toLowerCase())) {
    const index = roles.indexOf('ORG_ADMIN');
    if (index >= 0) roles.splice(index, 1);
  }
  return {
    token: row.token,
    address,
    roles,
  };
}

function cleanupExpiredData() {
  const now = new Date().toISOString();
  database.prepare('DELETE FROM challenges WHERE expires_at <= ?').run(now);
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  database.prepare('DELETE FROM wallet_shares WHERE expires_at <= ?').run(now);
  const cutoff = new Date(Date.now() - rateLimitWindowMs).getTime();
  for (const [key, value] of rateLimits) if (value.startedAt < cutoff) rateLimits.delete(key);
  const organizationCutoff = Date.now() - organizationIntakeWindowMs;
  for (const [key, value] of organizationApplicationRateLimits)
    if (value.startedAt < organizationCutoff) organizationApplicationRateLimits.delete(key);
  const walletShareCutoff = Date.now() - 60 * 60_000;
  for (const [key, value] of walletShareRateLimits)
    if (value.startedAt < walletShareCutoff) walletShareRateLimits.delete(key);
}

function clientKey(request: IncomingMessage) {
  if (trustProxy) {
    const forwarded = header(request, 'x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return request.socket.remoteAddress ?? 'unknown';
}

function checkRateLimit(request: IncomingMessage) {
  const now = Date.now();
  const key = clientKey(request);
  const current = rateLimits.get(key);
  if (!current || now - current.startedAt >= rateLimitWindowMs) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > rateLimitMax)
    throw new CredoraError('Too many requests', 'RATE_LIMITED', 429);
}

function checkOrganizationApplicationRateLimit(request: IncomingMessage) {
  const now = Date.now();
  const key = clientKey(request);
  const current = organizationApplicationRateLimits.get(key);
  if (!current || now - current.startedAt >= organizationIntakeWindowMs) {
    organizationApplicationRateLimits.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= organizationIntakeMax)
    throw new CredoraError(
      'Too many organization requests from this network. Please try again tomorrow.',
      'ORGANIZATION_INTAKE_LIMITED',
      429,
    );
  current.count += 1;
}

function checkWalletShareRateLimit(request: IncomingMessage) {
  const now = Date.now();
  const key = clientKey(request);
  const current = walletShareRateLimits.get(key);
  if (!current || now - current.startedAt >= 60 * 60_000) {
    walletShareRateLimits.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= 10)
    throw new CredoraError(
      'Too many share codes were created from this network. Try again in an hour.',
      'SHARE_RATE_LIMITED',
      429,
    );
  current.count += 1;
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function secureTokenMatches(candidate: string | undefined, expectedHash: string) {
  if (!candidate || !/^[A-Za-z0-9_-]{43}$/.test(candidate)) return false;
  const actual = Buffer.from(sha256(candidate), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requireSession(request: IncomingMessage) {
  const session = currentSession(request);
  if (!session) throw new CredoraError('A valid wallet session is required', 'UNAUTHORIZED', 401);
  return session;
}

function isSuperadmin(session: { roles: Role[] }) {
  return session.roles.includes('SUPERADMIN') || session.roles.includes('ADMIN');
}

function requireSuperadmin(request: IncomingMessage) {
  const session = requireSession(request);
  if (!isSuperadmin(session)) throw new CredoraError('Superadmin role required', 'FORBIDDEN', 403);
  return session;
}

async function requireCurrentSuperadmin(request: IncomingMessage) {
  const session = requireSuperadmin(request);
  if (configuredSuperadminAddresses.has(session.address.toLowerCase())) return session;
  try {
    let authorized = blockchain ? await blockchain.isAdmin(session.address) : false;
    if (!authorized && organizationPublicClient && organizationRegistryAddress) {
      const role = await organizationPublicClient.readContract({
        address: organizationRegistryAddress,
        abi: organizationCredentialRegistryAbi,
        functionName: 'DEFAULT_ADMIN_ROLE',
      });
      authorized = await organizationPublicClient.readContract({
        address: organizationRegistryAddress,
        abi: organizationCredentialRegistryAbi,
        functionName: 'hasRole',
        args: [role, session.address],
      });
    }
    if (!authorized)
      throw new CredoraError('Current on-chain superadmin authority is required', 'FORBIDDEN', 403);
  } catch (error) {
    if (error instanceof CredoraError) throw error;
    throw ledgerUnavailable();
  }
  return session;
}

function isOrgAdmin(session: { roles: Role[] }) {
  return session.roles.includes('ORG_ADMIN');
}

function requiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim())
    throw new CredoraError(`${key} is required`, 'INVALID_BODY', 400);
  return value.trim();
}

function requiredAddress(body: Record<string, unknown>, key: string) {
  const value = requiredString(body, key);
  try {
    return normalizeAddress(value, key);
  } catch {
    throw new CredoraError(`${key} must be a valid EVM address`, 'INVALID_BODY', 400);
  }
}

function requiredHash(body: Record<string, unknown>, key: string): Hex {
  try {
    return credentialReferenceFromHash(requiredString(body, key));
  } catch {
    throw new CredoraError(`${key} must be a 32-byte hash`, 'INVALID_BODY', 400);
  }
}

function requiredTransactionHash(body: Record<string, unknown>): Hex {
  const value = requiredString(body, 'transactionHash');
  if (!/^0x[0-9a-fA-F]{64}$/.test(value))
    throw new CredoraError('transactionHash must be a 32-byte hash', 'INVALID_BODY', 400);
  return value as Hex;
}

function requiredIssueDate(body: Record<string, unknown>): string {
  try {
    return normalizeIssueDate(requiredString(body, 'issueDate'));
  } catch {
    throw new CredoraError('issueDate must be a valid ISO date', 'INVALID_BODY', 400);
  }
}

function requireLedger(): BlockchainAdapter {
  if (!blockchain)
    throw new CredoraError('Credential ledger is not configured', 'LEDGER_UNAVAILABLE', 503);
  return blockchain;
}

function requireOrganizationRegistry() {
  if (!organizationPublicClient || !organizationRegistryAddress)
    throw new CredoraError(
      'Organization credential registry is not configured',
      'ORGANIZATION_REGISTRY_UNAVAILABLE',
      503,
    );
  return { client: organizationPublicClient, address: organizationRegistryAddress };
}

async function readOrganizationAuthority(organizationId: string) {
  const { client, address } = requireOrganizationRegistry();
  return client.readContract({
    address,
    abi: organizationCredentialRegistryAbi,
    functionName: 'getOrganization',
    args: [organizationIdFromApplicationId(organizationId)],
  });
}

async function isOrganizationIssuer(organizationId: string, issuer: string) {
  const { client, address } = requireOrganizationRegistry();
  const chainId = organizationIdFromApplicationId(organizationId);
  const [, , , exists, suspended] = await client.readContract({
    address,
    abi: organizationCredentialRegistryAbi,
    functionName: 'getOrganization',
    args: [chainId],
  });
  if (!exists || suspended) return false;
  return client.readContract({
    address,
    abi: organizationCredentialRegistryAbi,
    functionName: 'isAuthorizedIssuer',
    args: [chainId, normalizeAddress(issuer, 'issuer')],
  });
}

async function requireOrganizationAdminAuthority(organizationId: string, account: Address) {
  const organization = database
    .prepare("SELECT id FROM organizations WHERE id = ? AND status = 'active'")
    .get(organizationId) as { id: string } | undefined;
  if (!organization)
    throw new CredoraError('Organization is not active', 'ORGANIZATION_NOT_ACTIVE', 409);
  const { client, address } = requireOrganizationRegistry();
  let authorized: boolean;
  try {
    const [, , , exists, suspended] = await readOrganizationAuthority(organizationId);
    if (!exists || suspended)
      throw new CredoraError(
        'Organization authority is suspended or unavailable',
        'ORGANIZATION_SUSPENDED',
        403,
      );
    authorized = await client.readContract({
      address,
      abi: organizationCredentialRegistryAbi,
      functionName: 'isOrganizationAdmin',
      args: [organizationIdFromApplicationId(organizationId), account],
    });
  } catch (error) {
    if (error instanceof CredoraError) throw error;
    throw ledgerUnavailable();
  }
  if (!authorized)
    throw new CredoraError('Organization administrator role required', 'FORBIDDEN', 403);
  return organization;
}

function isOrganizationReviewer(organizationId: string, account: Address) {
  return Boolean(
    database
      .prepare(
        'SELECT 1 FROM organization_reviewers WHERE organization_id = ? AND wallet_address = ? AND active = 1',
      )
      .get(organizationId, account),
  );
}

function ledgerUnavailable(): CredoraError {
  return new CredoraError(
    'Unable to reach the credential ledger right now',
    'LEDGER_UNAVAILABLE',
    503,
  );
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function updateIssuanceState(id: string, state: OperationState) {
  database.prepare('UPDATE issuances SET state = ? WHERE id = ?').run(state, id);
}

function hashForIssuance(row: Record<string, unknown>, metadataUri: string): Hex {
  if (row.organization_id) {
    return hashOrganizationCredential({
      organizationId: organizationIdFromApplicationId(String(row.organization_id)),
      issuerAddress: normalizeAddress(String(row.issuer), 'issuer'),
      learnerAddress: normalizeAddress(String(row.learner), 'learner'),
      skillName: String(row.skill_name),
      skillLevel: String(row.skill_level),
      issueDate: String(row.issue_date),
      metadataUri,
    });
  }
  return hashCredential({
    issuerAddress: normalizeAddress(String(row.issuer), 'issuer'),
    learnerAddress: normalizeAddress(String(row.learner), 'learner'),
    skillName: String(row.skill_name),
    skillLevel: String(row.skill_level),
    issueDate: String(row.issue_date),
    metadataUri,
  });
}

function audit(actor: string, action: string, details: Record<string, unknown>) {
  database
    .prepare(
      'INSERT INTO audit_logs (id, actor, action, timestamp, details) VALUES (?, ?, ?, ?, ?)',
    )
    .run(randomUUID(), actor, action, new Date().toISOString(), stringifyJson(details));
}

let chainSyncInProgress = false;
let organizationChainSyncInProgress = false;

async function reconcileOrganizationCredentialEvents(resetFromBlock?: bigint) {
  if (!organizationPublicClient || !organizationRegistryAddress)
    return { synced: false, reason: 'ORGANIZATION_REGISTRY_UNAVAILABLE' };
  if (organizationChainSyncInProgress) return { synced: false, reason: 'SYNC_IN_PROGRESS' };
  organizationChainSyncInProgress = true;
  try {
    const sync = database
      .prepare('SELECT next_block FROM organization_chain_sync WHERE id = 1')
      .get() as { next_block: number } | undefined;
    const configuredStart = resetFromBlock ?? (sync ? BigInt(sync.next_block) : chainStartBlock);
    const latest = await organizationPublicClient.getBlockNumber();
    const safeLatest = latest > BigInt(confirmationDepth) ? latest - BigInt(confirmationDepth) : 0n;
    if (configuredStart > safeLatest)
      return { synced: true, fromBlock: configuredStart, toBlock: safeLatest, events: 0 };
    const fromBlock = resetFromBlock
      ? resetFromBlock
      : configuredStart > chainReorgRescanBlocks
        ? configuredStart - chainReorgRescanBlocks
        : chainStartBlock;
    database.exec('BEGIN');
    database
      .prepare('DELETE FROM organization_chain_events WHERE block_number >= ?')
      .run(Number(fromBlock));
    database
      .prepare(
        `UPDATE issuances SET transaction_hash = NULL, block_number = NULL,
         state = CASE WHEN metadata_uri IS NULL THEN 'draft' ELSE 'metadata-uploaded' END
         WHERE block_number >= ? AND projection_source = 'api' AND organization_id IS NOT NULL`,
      )
      .run(Number(fromBlock));
    database
      .prepare(
        "DELETE FROM issuances WHERE block_number >= ? AND projection_source = 'chain' AND organization_id IS NOT NULL",
      )
      .run(Number(fromBlock));
    database
      .prepare(
        'INSERT OR REPLACE INTO organization_chain_sync (id, next_block, updated_at) VALUES (1, ?, ?)',
      )
      .run(Number(fromBlock), new Date().toISOString());
    database.exec('COMMIT');

    const organizations = database.prepare('SELECT id FROM organizations').all() as {
      id: string;
    }[];
    let events = 0;
    const issuedEvent = {
      type: 'event',
      name: 'OrganizationCredentialIssued',
      anonymous: false,
      inputs: [
        { indexed: true, name: 'credentialHash', type: 'bytes32' },
        { indexed: true, name: 'organizationId', type: 'bytes32' },
        { indexed: true, name: 'issuer', type: 'address' },
        { indexed: false, name: 'learner', type: 'address' },
        { indexed: false, name: 'metadataUri', type: 'string' },
        { indexed: false, name: 'issuedAt', type: 'uint64' },
      ],
    } as const;
    for (let cursor = fromBlock; cursor <= safeLatest; cursor += chainChunkSize) {
      const toBlock =
        cursor + chainChunkSize - 1n > safeLatest ? safeLatest : cursor + chainChunkSize - 1n;
      const logs = await organizationPublicClient.getLogs({
        address: organizationRegistryAddress,
        event: issuedEvent,
        fromBlock: cursor,
        toBlock,
      });
      database.exec('BEGIN');
      for (const log of logs) {
        const { credentialHash, organizationId, issuer, learner, metadataUri, issuedAt } = log.args;
        if (
          !credentialHash ||
          !organizationId ||
          !issuer ||
          !learner ||
          metadataUri === undefined ||
          issuedAt === undefined
        )
          continue;
        const organization = organizations.find(
          (item) =>
            organizationIdFromApplicationId(item.id).toLowerCase() === organizationId.toLowerCase(),
        );
        database
          .prepare(
            `INSERT OR REPLACE INTO organization_chain_events
             (credential_hash, organization_id, issuer, learner, metadata_uri, issued_at,
              block_number, block_hash, transaction_hash, log_index, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            credentialHash,
            organization?.id ?? null,
            issuer,
            learner,
            metadataUri,
            Number(issuedAt),
            Number(log.blockNumber),
            log.blockHash,
            log.transactionHash,
            Number(log.logIndex),
            new Date().toISOString(),
          );
        if (organization) {
          let issueDate = new Date(Number(issuedAt) * 1000).toISOString();
          const updated = database
            .prepare(
              `UPDATE issuances SET transaction_hash = ?, state = 'confirmed', block_number = ?,
               organization_id = ? WHERE credential_hash = ?`,
            )
            .run(log.transactionHash, Number(log.blockNumber), organization.id, credentialHash);
          if (Number(updated.changes) === 0)
            database
              .prepare(
                `INSERT OR REPLACE INTO issuances
                 (id, issuer, learner, skill_name, skill_level, issue_date, metadata_uri,
                  credential_hash, transaction_hash, state, created_at, block_number,
                  projection_source, organization_id)
                 VALUES (?, ?, ?, 'organization credential', 'verified on registry', ?, ?, ?, ?, 'confirmed', ?, ?, 'chain', ?)`,
              )
              .run(
                `chain:${credentialHash}`,
                issuer,
                learner,
                issueDate,
                metadataUri,
                credentialHash,
                log.transactionHash,
                issueDate,
                Number(log.blockNumber),
                organization.id,
              );
        }
        events += 1;
      }
      database
        .prepare(
          'INSERT OR REPLACE INTO organization_chain_sync (id, next_block, updated_at) VALUES (1, ?, ?)',
        )
        .run(Number(toBlock + 1n), new Date().toISOString());
      database.exec('COMMIT');
      cursor = toBlock;
    }
    return { synced: true, fromBlock, toBlock: safeLatest, events };
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Preserve the original synchronization error.
    }
    incrementMetric('organization_chain_sync_errors_total');
    throw error;
  } finally {
    organizationChainSyncInProgress = false;
  }
}

async function reconcileChainEvents(resetFromBlock?: bigint) {
  if (!blockchain || chainSyncInProgress) return { synced: false, reason: 'LEDGER_UNAVAILABLE' };
  chainSyncInProgress = true;
  try {
    const sync = database.prepare('SELECT next_block FROM chain_sync WHERE id = 1').get() as
      { next_block: number } | undefined;
    const configuredStart = resetFromBlock ?? (sync ? BigInt(sync.next_block) : chainStartBlock);
    const latest = await blockchain.getBlockNumber();
    const safeLatest = latest > BigInt(confirmationDepth) ? latest - BigInt(confirmationDepth) : 0n;
    if (configuredStart > safeLatest)
      return { synced: true, fromBlock: configuredStart, toBlock: safeLatest, events: 0 };

    const fromBlock = resetFromBlock
      ? resetFromBlock
      : configuredStart > chainReorgRescanBlocks
        ? configuredStart - chainReorgRescanBlocks
        : chainStartBlock;
    database.exec('BEGIN');
    database.prepare('DELETE FROM chain_events WHERE block_number >= ?').run(Number(fromBlock));
    database
      .prepare(
        `UPDATE issuances
         SET transaction_hash = NULL, block_number = NULL,
             state = CASE WHEN metadata_uri IS NULL THEN 'draft' ELSE 'metadata-uploaded' END
         WHERE block_number >= ? AND projection_source = 'api'`,
      )
      .run(Number(fromBlock));
    database
      .prepare("DELETE FROM issuances WHERE block_number >= ? AND projection_source = 'chain'")
      .run(Number(fromBlock));
    database
      .prepare('INSERT OR REPLACE INTO chain_sync (id, next_block, updated_at) VALUES (1, ?, ?)')
      .run(Number(fromBlock), new Date().toISOString());
    database.exec('COMMIT');

    let events = 0;
    for (let cursor = fromBlock; cursor <= safeLatest; cursor += chainChunkSize) {
      const toBlock =
        cursor + chainChunkSize - 1n > safeLatest ? safeLatest : cursor + chainChunkSize - 1n;
      const logs = await blockchain.getCredentialIssuedEvents(cursor, toBlock);
      database.exec('BEGIN');
      for (const event of logs) {
        database
          .prepare(
            `INSERT OR REPLACE INTO chain_events
              (credential_hash, issuer, learner, metadata_uri, issued_at, block_number,
               block_hash, transaction_hash, log_index, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            event.credentialHash,
            event.issuer,
            event.learner,
            event.metadataUri,
            Number(event.issuedAt),
            Number(event.blockNumber),
            event.blockHash,
            event.transactionHash,
            Number(event.logIndex),
            new Date().toISOString(),
          );
        const updated = database
          .prepare(
            `UPDATE issuances
             SET transaction_hash = ?, block_number = ?, state = 'confirmed'
             WHERE credential_hash = ?`,
          )
          .run(event.transactionHash, Number(event.blockNumber), event.credentialHash);
        if (Number(updated.changes) === 0) {
          const issuedAt = new Date(Number(event.issuedAt) * 1000).toISOString();
          database
            .prepare(
              `INSERT INTO issuances
                (id, issuer, learner, skill_name, skill_level, issue_date, metadata_uri,
                 credential_hash, transaction_hash, state, created_at, block_number, projection_source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, 'chain')`,
            )
            .run(
              `chain:${event.credentialHash}`,
              event.issuer,
              event.learner,
              'reconciled',
              'reconciled',
              issuedAt,
              event.metadataUri,
              event.credentialHash,
              event.transactionHash,
              issuedAt,
              Number(event.blockNumber),
            );
        }
        events += 1;
      }
      database
        .prepare('INSERT OR REPLACE INTO chain_sync (id, next_block, updated_at) VALUES (1, ?, ?)')
        .run(Number(toBlock + 1n), new Date().toISOString());
      database.exec('COMMIT');
      incrementMetric('chain_events_processed_total');
      cursor = toBlock;
    }
    return { synced: true, fromBlock, toBlock: safeLatest, events };
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Preserve the original reconciliation error.
    }
    incrementMetric('chain_sync_errors_total');
    throw error;
  } finally {
    chainSyncInProgress = false;
  }
}

type ProfileRow = {
  id: string;
  handle: string;
  handleChangedAt: string;
  name: string;
  headline: string;
  bio: string;
  linksJson: string;
  published: number;
};
const reservedProfileHandles = new Set([
  'admin',
  'api',
  'auth',
  'dashboard',
  'issuer',
  'org',
  'profile',
  'settings',
  'share',
  'superadmin',
  'support',
  'u',
  'verify',
  'wallet',
  'www',
]);
function profileByWallet(address: string): ProfileRow | undefined {
  return database
    .prepare(
      `SELECT id, handle, handle_changed_at AS handleChangedAt, name, headline, bio, links_json AS linksJson, published FROM profiles WHERE wallet_address = ? COLLATE NOCASE`,
    )
    .get(address) as ProfileRow | undefined;
}
function profileView(row: ProfileRow) {
  const credentials = database
    .prepare(
      'SELECT credential_hash AS credentialHash FROM profile_credentials WHERE profile_id = ? ORDER BY position',
    )
    .all(row.id) as { credentialHash: string }[];
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    headline: row.headline,
    bio: row.bio,
    links: JSON.parse(row.linksJson) as string[],
    credentialHashes: credentials.map((item) => item.credentialHash),
    published: Boolean(row.published),
    handleChangedAt: row.handleChangedAt,
  };
}
function profileText(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw new CredoraError(
      `${label} must be ${required ? '1' : '0'}–${max} characters`,
      'INVALID_PROFILE',
      400,
    );
  return value.trim();
}
function profileHandle(value: unknown): string {
  if (typeof value !== 'string')
    throw new CredoraError('Enter a valid handle', 'INVALID_HANDLE', 400);
  const handle = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(handle) || reservedProfileHandles.has(handle))
    throw new CredoraError(
      'Handle must be 3–30 letters, numbers or underscores and cannot be reserved',
      'INVALID_HANDLE',
      400,
    );
  return handle;
}

async function route(request: IncomingMessage, response: ServerResponse) {
  checkRateLimit(request);
  const url = new URL(request.url ?? '/', 'http://localhost');
  const method = request.method ?? 'GET';
  const path = url.pathname;

  if (method === 'OPTIONS') {
    response.writeHead(204, originHeaders(request));
    response.end();
    return;
  }

  if (method === 'GET' && path === '/health') {
    send(request, response, 200, {
      ok: true,
      service: 'credora-api',
      time: new Date().toISOString(),
      ledger: {
        configured: Boolean(blockchain),
        chainId: configuredChainId,
        registryAddress: registryAddress ?? null,
        organizationRegistryConfigured: Boolean(organizationRegistryAddress),
        organizationRegistryAddress: organizationRegistryAddress ?? null,
      },
    });
    return;
  }

  if (method === 'GET' && path === '/readyz') {
    if (!blockchain) {
      send(request, response, 503, { ok: false, ready: false, reason: 'LEDGER_UNAVAILABLE' });
      return;
    }
    if (!organizationPublicClient || !organizationRegistryAddress) {
      send(request, response, 503, {
        ok: false,
        ready: false,
        reason: 'ORGANIZATION_REGISTRY_UNAVAILABLE',
      });
      return;
    }
    try {
      await blockchain.getCredential(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );
      await organizationPublicClient.readContract({
        address: organizationRegistryAddress,
        abi: organizationCredentialRegistryAbi,
        functionName: 'DEFAULT_ADMIN_ROLE',
      });
      send(request, response, 200, { ok: true, ready: true });
    } catch {
      send(request, response, 503, {
        ok: false,
        ready: false,
        reason: 'REGISTRY_UNAVAILABLE',
      });
    }
    return;
  }

  const assetMatch = path.match(/^\/assets\/([A-Za-z0-9_-]{8,128})$/);
  if (method === 'GET' && assetMatch) {
    let asset: { bytes: Uint8Array; contentType: string };
    try {
      asset = await storage.getAsset(assetMatch[1]);
    } catch {
      throw new CredoraError('Credential image is unavailable', 'ASSET_UNAVAILABLE', 404);
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(asset.contentType))
      throw new CredoraError('Credential image is unavailable', 'ASSET_UNAVAILABLE', 404);
    response.writeHead(200, {
      ...originHeaders(request),
      'content-type': asset.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    });
    response.end(Buffer.from(asset.bytes));
    return;
  }

  if (method === 'GET' && path === '/metrics') {
    send(request, response, 200, Object.fromEntries(metrics));
    return;
  }

  if (method === 'POST' && path === '/auth/challenge') {
    const body = await bodyOf(request);
    const address = requiredAddress(body, 'address');
    const expiresAt = new Date(Date.now() + challengeTtlMs).toISOString();
    const challenge: AuthChallenge = {
      address,
      nonce: createNonce(),
      expiresAt,
      message: '',
    };
    challenge.message = buildAuthMessage(challenge);
    database
      .prepare(
        'INSERT OR REPLACE INTO challenges (address, nonce, message, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(address, challenge.nonce, challenge.message, challenge.expiresAt);
    send(request, response, 200, challenge);
    return;
  }

  if (method === 'POST' && path === '/auth/verify') {
    const body = await bodyOf(request);
    const address = requiredAddress(body, 'address');
    const signature = requiredString(body, 'signature') as `0x${string}`;
    const challenge = database
      .prepare('SELECT * FROM challenges WHERE address = ?')
      .get(address) as
      { address: string; nonce: string; message: string; expires_at: string } | undefined;
    if (!challenge || Date.parse(challenge.expires_at) <= Date.now()) {
      throw new CredoraError(
        'Authentication challenge expired or missing',
        'CHALLENGE_EXPIRED',
        401,
      );
    }
    let valid = false;
    try {
      valid = await verifyAuthSignature(
        {
          address,
          nonce: challenge.nonce,
          message: challenge.message,
          expiresAt: challenge.expires_at,
        },
        signature,
      );
    } catch {
      valid = false;
    }
    if (!valid) throw new CredoraError('Wallet signature was not valid', 'INVALID_SIGNATURE', 401);
    const consumed = database
      .prepare('DELETE FROM challenges WHERE address = ? AND nonce = ?')
      .run(address, challenge.nonce);
    if (Number(consumed.changes) !== 1)
      throw new CredoraError(
        'Authentication challenge has already been used',
        'CHALLENGE_REPLAY',
        401,
      );
    const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
    const token = randomUUID();
    const roles: Role[] = ['LEARNER', 'VERIFIER'];
    const addRole = (role: Role) => {
      if (!roles.includes(role)) roles.unshift(role);
    };
    if (configuredOrgAdminAddresses.has(address.toLowerCase())) addRole('ORG_ADMIN');
    const approvedOrganization = database
      .prepare("SELECT id FROM organizations WHERE admin_address = ? AND status = 'active'")
      .get(address) as { id: string } | undefined;
    if (approvedOrganization) addRole('ORG_ADMIN');
    if (configuredSuperadminAddresses.has(address.toLowerCase())) {
      addRole('SUPERADMIN');
      addRole('ADMIN');
    }
    if (blockchain) {
      try {
        if (await blockchain.isIssuerAuthorized(address)) roles.unshift('ISSUER');
        if (await blockchain.isAdmin(address)) {
          addRole('SUPERADMIN');
          addRole('ADMIN');
        }
      } catch {
        // Authentication remains available while the ledger is restarting.
      }
    }
    if (organizationPublicClient && organizationRegistryAddress) {
      try {
        const role = await organizationPublicClient.readContract({
          address: organizationRegistryAddress,
          abi: organizationCredentialRegistryAbi,
          functionName: 'DEFAULT_ADMIN_ROLE',
        });
        if (
          await organizationPublicClient.readContract({
            address: organizationRegistryAddress,
            abi: organizationCredentialRegistryAbi,
            functionName: 'hasRole',
            args: [role, address],
          })
        ) {
          addRole('SUPERADMIN');
          addRole('ADMIN');
        }
      } catch {
        // The session can still be created; privileged routes recheck on-chain authority.
      }
    }
    database.prepare('DELETE FROM sessions WHERE address = ?').run(address);
    database
      .prepare(
        'INSERT INTO sessions (token, address, roles, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(token, address, JSON.stringify(roles), expiresAt, new Date().toISOString());
    audit(address, 'wallet_authenticated', { roles });
    send(request, response, 200, { token, address, roles, expiresAt });
    return;
  }

  if (method === 'POST' && path === '/auth/logout') {
    const session = requireSession(request);
    database.prepare('DELETE FROM sessions WHERE token = ?').run(session.token);
    send(request, response, 200, { ok: true });
    return;
  }

  if (method === 'GET' && path === '/me') {
    const session = requireSession(request);
    send(request, response, 200, session);
    return;
  }

  if (method === 'GET' && path === '/issuances') {
    const session = requireSession(request);
    const requestedOrganizationId = url.searchParams.get('organizationId');
    if (!session.roles.includes('ISSUER') && !isOrgAdmin(session) && !requestedOrganizationId)
      throw new CredoraError('Issuer or organization-admin role required', 'FORBIDDEN', 403);
    const limitValue = Number(url.searchParams.get('limit') ?? 50);
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100)
      throw new CredoraError('limit must be 1-100', 'INVALID_QUERY', 400);
    const organization = requestedOrganizationId
      ? (database
          .prepare("SELECT id FROM organizations WHERE id = ? AND status = 'active'")
          .get(requestedOrganizationId) as { id: string } | undefined)
      : isOrgAdmin(session)
        ? (database
            .prepare("SELECT id FROM organizations WHERE admin_address = ? AND status = 'active'")
            .get(session.address) as { id: string } | undefined)
        : undefined;
    if (requestedOrganizationId && !organization)
      throw new CredoraError('Organization is not active', 'ORGANIZATION_NOT_ACTIVE', 409);
    if (organization) {
      let authorized = false;
      let organizationAdmin = false;
      try {
        authorized = await isOrganizationIssuer(organization.id, session.address);
        const { client, address } = requireOrganizationRegistry();
        organizationAdmin = await client.readContract({
          address,
          abi: organizationCredentialRegistryAbi,
          functionName: 'isOrganizationAdmin',
          args: [organizationIdFromApplicationId(organization.id), session.address],
        });
      } catch {
        throw ledgerUnavailable();
      }
      if (!authorized && !organizationAdmin)
        throw new CredoraError(
          'This wallet is not an authorized issuer for the organization',
          'FORBIDDEN',
          403,
        );
    }
    const items = database
      .prepare(
        organization
          ? `SELECT id, issuer, learner, skill_name, skill_level, issue_date, metadata_uri,
                credential_hash, transaction_hash, block_number, state, review_status, batch_id, created_at
         FROM issuances WHERE organization_id = ?
         ORDER BY created_at DESC LIMIT ?`
          : `SELECT id, issuer, learner, skill_name, skill_level, issue_date, metadata_uri,
                credential_hash, transaction_hash, block_number, state, review_status, created_at
         FROM issuances WHERE issuer = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(organization?.id ?? session.address, limitValue);
    send(request, response, 200, { items, limit: limitValue });
    return;
  }

  if (path === '/profile' && method === 'GET') {
    const session = requireSession(request);
    const row = profileByWallet(session.address);
    send(request, response, 200, { profile: row ? profileView(row) : null });
    return;
  }

  if (path === '/profile' && method === 'PUT') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const handle = profileHandle(body.handle);
    const name = profileText(body.name, 'Name', 100, true);
    const headline = profileText(body.headline, 'Headline', 160);
    const bio = profileText(body.bio, 'Bio', 1000);
    if (!Array.isArray(body.links) || body.links.length > 10)
      throw new CredoraError('Choose up to 10 links', 'INVALID_PROFILE', 400);
    const links = body.links.map((value) => {
      const link = profileText(value, 'Link', 500, true);
      try {
        const url = new URL(link);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
        return url.toString();
      } catch {
        throw new CredoraError('Links must be valid HTTP or HTTPS URLs', 'INVALID_PROFILE', 400);
      }
    });
    if (typeof body.published !== 'boolean')
      throw new CredoraError('Choose a publication setting', 'INVALID_PROFILE', 400);
    if (!Array.isArray(body.credentialHashes) || body.credentialHashes.length > 25)
      throw new CredoraError('Choose up to 25 credentials', 'INVALID_PROFILE', 400);
    const hashes = body.credentialHashes.map((value) => {
      try {
        if (typeof value !== 'string') throw new Error();
        return credentialReferenceFromHash(value).toLowerCase();
      } catch {
        throw new CredoraError('Invalid credential reference', 'INVALID_PROFILE', 400);
      }
    });
    if (new Set(hashes).size !== hashes.length)
      throw new CredoraError('Duplicate credential selection', 'INVALID_PROFILE', 400);
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      const existing = profileByWallet(session.address);
      if (
        existing &&
        existing.handle !== handle &&
        Date.now() - Date.parse(existing.handleChangedAt) < 30 * 24 * 60 * 60 * 1000
      )
        throw new CredoraError('Handles can be changed once every 30 days', 'HANDLE_COOLDOWN', 409);
      for (const hash of hashes) {
        const owned = database
          .prepare(
            "SELECT 1 FROM issuances WHERE lower(credential_hash) = ? AND learner = ? COLLATE NOCASE AND state = 'confirmed' LIMIT 1",
          )
          .get(hash, session.address);
        if (!owned)
          throw new CredoraError(
            'A selected credential is not a confirmed credential for this wallet',
            'INVALID_PROFILE_SELECTION',
            400,
          );
      }
      const id = existing?.id ?? randomUUID();
      if (existing)
        database
          .prepare(
            'UPDATE profiles SET handle = ?, handle_changed_at = ?, name = ?, headline = ?, bio = ?, links_json = ?, published = ? WHERE id = ?',
          )
          .run(
            handle,
            existing.handle === handle ? existing.handleChangedAt : now,
            name,
            headline,
            bio,
            JSON.stringify(links),
            Number(body.published),
            id,
          );
      else
        database
          .prepare(
            'INSERT INTO profiles (id, wallet_address, handle, handle_changed_at, name, headline, bio, links_json, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            id,
            session.address,
            handle,
            now,
            name,
            headline,
            bio,
            JSON.stringify(links),
            Number(body.published),
          );
      database.prepare('DELETE FROM profile_credentials WHERE profile_id = ?').run(id);
      const insert = database.prepare(
        'INSERT INTO profile_credentials (profile_id, credential_hash, position) VALUES (?, ?, ?)',
      );
      hashes.forEach((hash, index) => insert.run(id, hash, index));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      if (
        error instanceof Error &&
        /UNIQUE constraint failed: profiles\.handle/i.test(error.message)
      )
        throw new CredoraError('That handle is already in use', 'HANDLE_TAKEN', 409);
      throw error;
    }
    send(request, response, 200, { profile: profileView(profileByWallet(session.address)!) });
    return;
  }

  const publicProfile = path.match(/^\/profiles\/([^/]+)$/);
  if (method === 'GET' && publicProfile) {
    const handle = profileHandle(decodeURIComponent(publicProfile[1]));
    const row = database
      .prepare(
        'SELECT id, handle, handle_changed_at AS handleChangedAt, name, headline, bio, links_json AS linksJson, published FROM profiles WHERE handle = ? AND published = 1',
      )
      .get(handle) as ProfileRow | undefined;
    if (!row) throw new CredoraError('Profile not found', 'PROFILE_NOT_FOUND', 404);
    const {
      handleChangedAt: _handleChangedAt,
      published: _published,
      ...profile
    } = profileView(row);
    send(request, response, 200, { profile });
    return;
  }

  if (method === 'GET' && path === '/credentials') {
    const session = requireSession(request);
    const limitValue = Number(url.searchParams.get('limit') ?? 50);
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100)
      throw new CredoraError('limit must be 1-100', 'INVALID_QUERY', 400);
    const items = database
      .prepare(
        `SELECT issuances.credential_hash, issuances.issuer, issuances.learner,
                issuances.metadata_uri, issuances.transaction_hash, issuances.block_number,
                issuances.state, issuances.issue_date, issuances.skill_name, issuances.skill_level,
                organizations.name AS organization_name,
                organizations.logo_url AS organization_logo_url
         FROM issuances
         LEFT JOIN organizations ON organizations.id = issuances.organization_id
         WHERE learner = ? AND state = 'confirmed'
         ORDER BY issue_date DESC
         LIMIT ?`,
      )
      .all(session.address, limitValue);
    send(request, response, 200, {
      items,
      limit: limitValue,
      source: 'api-projection',
      sourceNote: 'Public proof remains authoritative on the registry and metadata source.',
    });
    return;
  }

  const publicOrganization = path.match(/^\/organizations\/by-issuer\/([^/]+)$/);
  if (method === 'GET' && publicOrganization) {
    let address: Address;
    try {
      address = normalizeAddress(decodeURIComponent(publicOrganization[1]), 'issuer');
    } catch {
      throw new CredoraError('Issuer address must be a valid EVM address', 'INVALID_QUERY', 400);
    }
    const organization =
      database
        .prepare(
          "SELECT name AS name, website_url AS websiteUrl, logo_url AS logoUrl FROM organizations WHERE admin_address = ? AND status = 'active'",
        )
        .get(address) ?? null;
    send(request, response, 200, { organization });
    return;
  }

  if (method === 'POST' && path === '/wallet/shares') {
    checkWalletShareRateLimit(request);
    const body = await bodyOf(request);
    if (
      !Array.isArray(body.credentialHashes) ||
      body.credentialHashes.length < 1 ||
      body.credentialHashes.length > 25
    )
      throw new CredoraError(
        'Choose between 1 and 25 credentials to share',
        'INVALID_SHARE_SELECTION',
        400,
      );
    const durationDays = body.durationDays;
    if (durationDays !== 1 && durationDays !== 7 && durationDays !== 30)
      throw new CredoraError(
        'Choose a share duration of 1, 7, or 30 days',
        'INVALID_SHARE_DURATION',
        400,
      );
    const credentialHashes = body.credentialHashes.map((value) => {
      if (typeof value !== 'string')
        throw new CredoraError('Every credential reference must be a hash', 'INVALID_BODY', 400);
      try {
        return credentialReferenceFromHash(value).toLowerCase();
      } catch {
        throw new CredoraError(
          'Every credential reference must be a valid hash',
          'INVALID_BODY',
          400,
        );
      }
    });
    if (new Set(credentialHashes).size !== credentialHashes.length)
      throw new CredoraError(
        'Remove duplicate credentials from the selection',
        'INVALID_BODY',
        400,
      );
    const activeShareCount = database
      .prepare(
        'SELECT COUNT(*) AS count FROM wallet_shares WHERE revoked_at IS NULL AND expires_at > ?',
      )
      .get(new Date().toISOString()) as { count: number };
    if (Number(activeShareCount.count) >= 10_000)
      throw new CredoraError(
        'The sharing service is busy. Try again later.',
        'SHARE_CAPACITY_REACHED',
        503,
      );

    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const managementToken = randomBytes(32).toString('base64url');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60_000).toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          'INSERT INTO wallet_shares (id, token_hash, management_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(id, sha256(token), sha256(managementToken), createdAt.toISOString(), expiresAt);
      const addCredential = database.prepare(
        'INSERT INTO wallet_share_credentials (share_id, credential_hash, position) VALUES (?, ?, ?)',
      );
      credentialHashes.forEach((hash, position) => addCredential.run(id, hash, position));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    audit('public-share', 'wallet_share_created', {
      shareId: id,
      count: credentialHashes.length,
      durationDays,
      expiresAt,
    });
    send(request, response, 201, { id, token, managementToken, expiresAt, durationDays });
    return;
  }

  const publicShare = path.match(/^\/wallet\/shares\/([A-Za-z0-9_-]{43})$/);
  if (method === 'GET' && publicShare) {
    const token = publicShare[1];
    const share = database
      .prepare(
        'SELECT id, expires_at AS expiresAt, revoked_at AS revokedAt FROM wallet_shares WHERE token_hash = ?',
      )
      .get(sha256(token)) as
      { id: string; expiresAt: string; revokedAt: string | null } | undefined;
    if (!share) throw new CredoraError('This share code is unavailable', 'SHARE_NOT_FOUND', 404);
    if (share.revokedAt || Date.parse(share.expiresAt) <= Date.now())
      throw new CredoraError('This share code has expired or was turned off', 'SHARE_EXPIRED', 410);
    const credentials = database
      .prepare(
        'SELECT credential_hash AS credentialHash FROM wallet_share_credentials WHERE share_id = ? ORDER BY position ASC',
      )
      .all(share.id);
    send(request, response, 200, { expiresAt: share.expiresAt, credentials });
    return;
  }

  const revokeShare = path.match(/^\/wallet\/shares\/([0-9a-f-]{36})$/i);
  if (method === 'DELETE' && revokeShare) {
    const id = revokeShare[1];
    const share = database
      .prepare(
        'SELECT management_hash AS managementHash, expires_at AS expiresAt, revoked_at AS revokedAt FROM wallet_shares WHERE id = ?',
      )
      .get(id) as
      { managementHash: string; expiresAt: string; revokedAt: string | null } | undefined;
    if (!share) throw new CredoraError('Share code not found', 'NOT_FOUND', 404);
    if (!secureTokenMatches(header(request, 'x-share-management-token'), share.managementHash))
      throw new CredoraError('Share management key required', 'FORBIDDEN', 403);
    if (share.revokedAt || Date.parse(share.expiresAt) <= Date.now())
      throw new CredoraError(
        'This share code has expired or was already turned off',
        'SHARE_EXPIRED',
        410,
      );
    const revokedAt = new Date().toISOString();
    database
      .prepare('UPDATE wallet_shares SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .run(revokedAt, id);
    audit('public-share', 'wallet_share_revoked', { shareId: id, revokedAt });
    send(request, response, 200, { id, revokedAt });
    return;
  }

  if (method === 'GET' && path === '/org/overview') {
    const session = requireSession(request);
    const requestedOrganizationId = url.searchParams.get('organizationId');
    const organization = requestedOrganizationId
      ? (database
          .prepare('SELECT id, name, status FROM organizations WHERE id = ?')
          .get(requestedOrganizationId) as { id: string; name: string; status: string } | undefined)
      : (database
          .prepare('SELECT id, name, status FROM organizations WHERE admin_address = ?')
          .get(session.address) as { id: string; name: string; status: string } | undefined);
    if (!organization) throw new CredoraError('Organization workspace not found', 'NOT_FOUND', 404);
    let issuerAuthorization: 'authorized' | 'not-authorized' | 'unavailable' = 'unavailable';
    let organizationAdmin = false;
    let chainOrganizationStatus: 'active' | 'suspended' | 'not-activated' = 'not-activated';
    try {
      const [initialAdmin, , , exists, suspended] = await readOrganizationAuthority(
        organization.id,
      );
      if (exists) {
        chainOrganizationStatus = suspended ? 'suspended' : 'active';
        organizationAdmin = await requireOrganizationRegistry().client.readContract({
          address: requireOrganizationRegistry().address,
          abi: organizationCredentialRegistryAbi,
          functionName: 'isOrganizationAdmin',
          args: [organizationIdFromApplicationId(organization.id), session.address],
        });
        issuerAuthorization = (await isOrganizationIssuer(organization.id, session.address))
          ? 'authorized'
          : 'not-authorized';
      }
      if (sameAddress(initialAdmin, session.address)) organizationAdmin = true;
    } catch {
      // Preserve an explicit unavailable state; projections do not confer chain authority.
    }
    if (
      !organizationAdmin &&
      issuerAuthorization !== 'authorized' &&
      !isOrgAdmin(session) &&
      !isOrganizationReviewer(organization.id, session.address)
    )
      throw new CredoraError(
        'Organization membership or issuer authority required',
        'FORBIDDEN',
        403,
      );
    const counts = database
      .prepare(
        `SELECT state, COUNT(*) AS count
         FROM issuances
         WHERE ${organization ? 'organization_id = ?' : 'issuer = ?'}
         GROUP BY state`,
      )
      .all(organization?.id ?? session.address) as { state: string; count: number }[];
    send(request, response, 200, {
      address: session.address,
      organization: { id: organization.id, name: organization.name },
      issuerAuthorization,
      organizationAdmin,
      chainOrganizationStatus,
      operationalStatus: organization.status,
      roles: session.roles,
      issuanceCounts: Object.fromEntries(counts.map((row) => [row.state, Number(row.count)])),
      projection: 'api',
      projectionNote: 'Counts are operational projections; the registry remains authoritative.',
    });
    return;
  }

  if (method === 'POST' && path === '/org/applications') {
    const session = requireSession(request);
    checkOrganizationApplicationRateLimit(request);
    const pendingCount = database
      .prepare("SELECT COUNT(*) AS count FROM organization_applications WHERE status = 'pending'")
      .get() as { count: number };
    if (Number(pendingCount.count) >= organizationIntakeMaxPending)
      throw new CredoraError(
        'The organization review queue is full. Please try again after requests have been reviewed.',
        'APPLICATION_QUEUE_FULL',
        429,
      );
    const body = await bodyOf(request);
    const name = requiredString(body, 'organizationName').normalize('NFC').replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name))
      throw new CredoraError(
        'Organization name must be 2-120 readable characters',
        'INVALID_BODY',
        400,
      );
    const websiteInput = requiredString(body, 'websiteUrl');
    let website: URL;
    try {
      website = new URL(websiteInput);
    } catch {
      throw new CredoraError('Enter the organization’s public HTTPS website', 'INVALID_BODY', 400);
    }
    if (
      website.protocol !== 'https:' ||
      website.username ||
      website.password ||
      websiteInput.length > 2048
    )
      throw new CredoraError(
        'Organization website must be a public HTTPS URL',
        'INVALID_BODY',
        400,
      );
    const websiteUrl = website.toString();
    const legalName = requiredString(body, 'legalName').normalize('NFC').replace(/\s+/g, ' ');
    if (legalName.length < 2 || legalName.length > 160 || /[\u0000-\u001f\u007f]/.test(legalName))
      throw new CredoraError(
        'Legal organization name must be 2-160 readable characters',
        'INVALID_BODY',
        400,
      );
    const registrationReference = requiredString(body, 'registrationReference');
    if (registrationReference.length > 160 || /[\u0000-\u001f\u007f]/.test(registrationReference))
      throw new CredoraError('Registration reference is invalid', 'INVALID_BODY', 400);
    let evidence: URL;
    try {
      evidence = new URL(requiredString(body, 'evidenceUrl'));
    } catch {
      throw new CredoraError(
        'Provide an HTTPS link to organization verification evidence',
        'INVALID_BODY',
        400,
      );
    }
    if (evidence.protocol !== 'https:' || evidence.username || evidence.password)
      throw new CredoraError(
        'Verification evidence must use a public HTTPS URL',
        'INVALID_BODY',
        400,
      );
    const evidenceUrl = evidence.toString();
    const logoInput = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : '';
    let logoUrl: string | null = null;
    if (logoInput) {
      let logo: URL;
      try {
        logo = new URL(logoInput);
      } catch {
        throw new CredoraError(
          'Organization logo must be an HTTPS image on its official website',
          'INVALID_BODY',
          400,
        );
      }
      if (
        logo.protocol !== 'https:' ||
        logo.username ||
        logo.password ||
        logo.origin !== website.origin ||
        logoInput.length > 2048
      )
        throw new CredoraError(
          'Organization logo must use the same HTTPS website origin as the organization site',
          'INVALID_BODY',
          400,
        );
      logoUrl = logo.toString();
    }
    if (
      configuredOrgAdminAddresses.has(session.address.toLowerCase()) ||
      session.roles.includes('ORG_ADMIN')
    )
      throw new CredoraError(
        'This wallet already has organization access',
        'ALREADY_ORG_ADMIN',
        409,
      );
    const existing = database
      .prepare(
        "SELECT id FROM organizations WHERE admin_address = ? AND status IN ('active', 'suspended')",
      )
      .get(session.address);
    if (existing)
      throw new CredoraError('This wallet already owns an organization', 'APPLICATION_EXISTS', 409);
    const pending = database
      .prepare(
        "SELECT id FROM organization_applications WHERE applicant_address = ? AND status = 'pending'",
      )
      .get(session.address);
    if (pending)
      throw new CredoraError(
        'This wallet already has a request awaiting review',
        'APPLICATION_PENDING',
        409,
      );
    const duplicateName =
      database
        .prepare(
          "SELECT id FROM organization_applications WHERE lower(organization_name) = lower(?) AND status = 'pending'",
        )
        .get(name) ??
      database.prepare('SELECT id FROM organizations WHERE lower(name) = lower(?)').get(name);
    if (duplicateName)
      throw new CredoraError(
        'An organization with this name is already registered or awaiting review',
        'ORGANIZATION_NAME_TAKEN',
        409,
      );
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    try {
      database
        .prepare(
          `INSERT INTO organization_applications
          (id, organization_name, website_url, applicant_address, status, created_at, logo_url,
           legal_name, evidence_url, registration_reference)
          VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          name,
          websiteUrl,
          session.address,
          createdAt,
          logoUrl,
          legalName,
          evidenceUrl,
          registrationReference,
        );
    } catch (error) {
      if (isSqliteConstraint(error))
        throw new CredoraError(
          'A request from this wallet or an organization with this name is already pending',
          'APPLICATION_PENDING',
          409,
        );
      throw error;
    }
    audit(session.address, 'organization_application_submitted', {
      id,
      name,
      legalName,
      websiteUrl,
      evidenceUrl,
      registrationReference,
      logoUrl,
    });
    send(request, response, 201, {
      id,
      organizationName: name,
      websiteUrl,
      legalName,
      evidenceUrl,
      registrationReference,
      logoUrl,
      applicantAddress: session.address,
      status: 'pending',
      createdAt,
    });
    return;
  }

  if (method === 'GET' && path === '/org/applications/mine') {
    const session = requireSession(request);
    const application = database
      .prepare(
        `SELECT id, organization_name AS organizationName, website_url AS websiteUrl,
      logo_url AS logoUrl,
      applicant_address AS applicantAddress, status, created_at AS createdAt, reviewed_at AS reviewedAt
      FROM organization_applications WHERE applicant_address = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(session.address);
    send(request, response, 200, { application: application ?? null });
    return;
  }

  if (method === 'GET' && path === '/superadmin/organization-applications') {
    await requireCurrentSuperadmin(request);
    const applications = database
      .prepare(
        `SELECT id, organization_name AS organizationName, legal_name AS legalName,
      registration_reference AS registrationReference, evidence_url AS evidenceUrl,
      website_url AS websiteUrl,
      logo_url AS logoUrl, applicant_address AS applicantAddress, status, created_at AS createdAt
      FROM organization_applications WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`,
      )
      .all();
    const organizations = database
      .prepare(
        `SELECT id, name, website_url AS websiteUrl, logo_url AS logoUrl, admin_address AS adminAddress, status,
      created_at AS createdAt FROM organizations ORDER BY created_at DESC LIMIT 100`,
      )
      .all();
    send(request, response, 200, { applications, organizations });
    return;
  }

  if (method === 'GET' && path === '/org/issuers') {
    const session = requireSession(request);
    const organizationId = url.searchParams.get('organizationId') ?? '';
    const organization = database
      .prepare(
        "SELECT id, approval_required AS approvalRequired FROM organizations WHERE id = ? AND status = 'active'",
      )
      .get(organizationId) as { id: string; approvalRequired: number } | undefined;
    if (!organization)
      throw new CredoraError('Organization is not active', 'ORGANIZATION_NOT_ACTIVE', 409);
    const { client, address } = requireOrganizationRegistry();
    let isAdmin: boolean;
    try {
      isAdmin = await client.readContract({
        address,
        abi: organizationCredentialRegistryAbi,
        functionName: 'isOrganizationAdmin',
        args: [organizationIdFromApplicationId(organizationId), session.address],
      });
    } catch {
      throw ledgerUnavailable();
    }
    if (!isAdmin)
      throw new CredoraError('Organization administrator role required', 'FORBIDDEN', 403);
    const issuers = database
      .prepare(
        `SELECT wallet_address AS address, active, updated_at AS updatedAt
         FROM organization_issuer_keys WHERE organization_id = ? ORDER BY updated_at DESC`,
      )
      .all(organizationId);
    send(request, response, 200, { issuers });
    return;
  }

  if (method === 'GET' && path === '/org/team') {
    const session = requireSession(request);
    const organizationId = url.searchParams.get('organizationId') ?? '';
    await requireOrganizationAdminAuthority(organizationId, session.address);
    const members = database
      .prepare(
        `SELECT wallet_address AS address, role, status, updated_at AS updatedAt
         FROM organization_memberships WHERE organization_id = ? ORDER BY role, wallet_address`,
      )
      .all(organizationId);
    send(request, response, 200, { members });
    return;
  }

  if (method === 'POST' && path === '/org/team/confirm') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId = requiredString(body, 'organizationId');
    const account = requiredAddress(body, 'account');
    if (typeof body.authorized !== 'boolean')
      throw new CredoraError('authorized must be a boolean', 'INVALID_BODY', 400);
    const authorized = body.authorized;
    const transactionHash = requiredTransactionHash(body);
    await requireOrganizationAdminAuthority(organizationId, session.address);
    const { client, address } = requireOrganizationRegistry();
    let transaction;
    let receipt;
    try {
      [transaction, receipt] = await Promise.all([
        client.getTransaction({ hash: transactionHash }),
        client.waitForTransactionReceipt({ hash: transactionHash }),
      ]);
    } catch {
      throw ledgerUnavailable();
    }
    if (
      !transaction.to ||
      !sameAddress(transaction.to, address) ||
      !sameAddress(transaction.from, session.address) ||
      receipt.status !== 'success'
    )
      throw new CredoraError(
        'Team update is not confirmed from this organization admin wallet',
        'TEAM_UPDATE_INVALID',
        409,
      );
    let decoded;
    try {
      decoded = decodeFunctionData({
        abi: organizationCredentialRegistryAbi,
        data: transaction.input,
      });
    } catch {
      throw new CredoraError(
        'Transaction does not change organization administrators',
        'TEAM_UPDATE_INVALID',
        409,
      );
    }
    if (decoded.functionName !== 'setOrganizationAdmin')
      throw new CredoraError(
        'Transaction does not change organization administrators',
        'TEAM_UPDATE_INVALID',
        409,
      );
    const [chainOrganizationId, chainAccount, chainAuthorized] = decoded.args;
    if (
      chainOrganizationId.toLowerCase() !==
        organizationIdFromApplicationId(organizationId).toLowerCase() ||
      !sameAddress(chainAccount, account) ||
      chainAuthorized !== authorized
    )
      throw new CredoraError(
        'Team transaction does not match the requested wallet and action',
        'TEAM_UPDATE_MISMATCH',
        409,
      );
    const actualAuthorization = await client.readContract({
      address,
      abi: organizationCredentialRegistryAbi,
      functionName: 'isOrganizationAdmin',
      args: [organizationIdFromApplicationId(organizationId), account],
    });
    if (actualAuthorization !== authorized)
      throw new CredoraError(
        'Team update has not finalized on the registry',
        'TEAM_UPDATE_NOT_FINALIZED',
        409,
      );
    const updatedAt = new Date().toISOString();
    if (authorized) {
      database
        .prepare(
          `INSERT INTO organization_memberships (organization_id, wallet_address, role, status, updated_at)
           VALUES (?, ?, 'admin', 'active', ?)
           ON CONFLICT(organization_id, wallet_address) DO UPDATE SET role = 'admin', status = 'active', updated_at = excluded.updated_at`,
        )
        .run(organizationId, account, updatedAt);
    } else {
      database
        .prepare(
          "UPDATE organization_memberships SET status = 'removed', updated_at = ? WHERE organization_id = ? AND wallet_address = ? AND role = 'admin'",
        )
        .run(updatedAt, organizationId, account);
    }
    audit(session.address, 'organization_admin_changed', {
      organizationId,
      account,
      authorized,
      transactionHash,
    });
    send(request, response, 200, { organizationId, account, authorized, transactionHash });
    return;
  }

  if (method === 'GET' && path === '/org/templates') {
    const session = requireSession(request);
    const organizationId = url.searchParams.get('organizationId') ?? '';
    await requireOrganizationAdminAuthority(organizationId, session.address);
    const items = database
      .prepare(
        `SELECT id, name, skill_name AS skillName, skill_level AS skillLevel,
         description, version, active, created_at AS createdAt
         FROM credential_templates WHERE organization_id = ? ORDER BY name, version DESC`,
      )
      .all(organizationId);
    const withMetadata = await Promise.all(
      (items as Record<string, unknown>[]).map(async (item) => {
        if (typeof item.metadataUri !== 'string') return { ...item, metadata: null };
        try {
          return { ...item, metadata: await storage.get(item.metadataUri) };
        } catch {
          return { ...item, metadata: null, metadataUnavailable: true };
        }
      }),
    );
    send(request, response, 200, { items: withMetadata });
    return;
  }

  if (method === 'GET' && path === '/org/policy') {
    const session = requireSession(request);
    const organizationId = url.searchParams.get('organizationId') ?? '';
    await requireOrganizationAdminAuthority(organizationId, session.address);
    const organization = database
      .prepare('SELECT approval_required AS approvalRequired FROM organizations WHERE id = ?')
      .get(organizationId) as { approvalRequired: number };
    const reviewers = database
      .prepare(
        'SELECT wallet_address AS address, active FROM organization_reviewers WHERE organization_id = ? ORDER BY wallet_address',
      )
      .all(organizationId);
    send(request, response, 200, {
      approvalRequired: Boolean(organization.approvalRequired),
      reviewers,
    });
    return;
  }

  if (method === 'POST' && path === '/org/policy') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId = requiredString(body, 'organizationId');
    await requireOrganizationAdminAuthority(organizationId, session.address);
    if (typeof body.approvalRequired !== 'boolean')
      throw new CredoraError('approvalRequired must be a boolean', 'INVALID_BODY', 400);
    const reviewers =
      body.reviewers === undefined
        ? (
            database
              .prepare(
                'SELECT wallet_address AS address FROM organization_reviewers WHERE organization_id = ? AND active = 1',
              )
              .all(organizationId) as { address: string }[]
          ).map((item) => item.address)
        : Array.isArray(body.reviewers)
          ? body.reviewers.map((value, index) => {
              if (typeof value !== 'string')
                throw new CredoraError(
                  `reviewers[${index}] must be a wallet address`,
                  'INVALID_BODY',
                  400,
                );
              try {
                return normalizeAddress(value, `reviewers[${index}]`);
              } catch {
                throw new CredoraError(
                  `reviewers[${index}] must be a wallet address`,
                  'INVALID_BODY',
                  400,
                );
              }
            })
          : (() => {
              throw new CredoraError(
                'reviewers must be an array of wallet addresses',
                'INVALID_BODY',
                400,
              );
            })();
    if (new Set(reviewers.map((item) => item.toLowerCase())).size !== reviewers.length)
      throw new CredoraError('Reviewer wallet addresses must be unique', 'INVALID_BODY', 400);
    if (body.approvalRequired && reviewers.length === 0)
      throw new CredoraError(
        'Add at least one reviewer before requiring internal approval',
        'REVIEWER_REQUIRED',
        409,
      );
    const updatedAt = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare('UPDATE organizations SET approval_required = ?, updated_at = ? WHERE id = ?')
        .run(body.approvalRequired ? 1 : 0, updatedAt, organizationId);
      if (body.reviewers !== undefined) {
        database
          .prepare(
            'UPDATE organization_reviewers SET active = 0, updated_at = ? WHERE organization_id = ?',
          )
          .run(updatedAt, organizationId);
        const addReviewer = database.prepare(
          `INSERT INTO organization_reviewers (organization_id, wallet_address, active, updated_at)
           VALUES (?, ?, 1, ?)
           ON CONFLICT(organization_id, wallet_address) DO UPDATE SET active = 1, updated_at = excluded.updated_at`,
        );
        reviewers.forEach((reviewer) => addReviewer.run(organizationId, reviewer, updatedAt));
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    audit(session.address, 'organization_issuance_policy_updated', {
      organizationId,
      approvalRequired: body.approvalRequired,
      reviewers,
    });
    send(request, response, 200, {
      organizationId,
      approvalRequired: body.approvalRequired,
      reviewers,
    });
    return;
  }

  if (method === 'GET' && path === '/org/issuances/review-queue') {
    const session = requireSession(request);
    const organizationId = url.searchParams.get('organizationId') ?? '';
    const reviewer = isOrganizationReviewer(organizationId, session.address);
    if (!reviewer) await requireOrganizationAdminAuthority(organizationId, session.address);
    const items = database
      .prepare(
        `SELECT id, batch_id AS batchId, learner, skill_name AS skillName,
         skill_level AS skillLevel, issue_date AS issueDate, metadata_uri AS metadataUri,
         credential_hash AS credentialHash, review_status AS reviewStatus, created_at AS createdAt
         FROM issuances WHERE organization_id = ? AND review_status = 'pending'
         ORDER BY created_at ASC LIMIT 200`,
      )
      .all(organizationId);
    const preparedItems = await Promise.all(
      (items as Record<string, unknown>[]).map(async (item) => {
        if (typeof item.metadataUri !== 'string') return { ...item, metadata: null };
        try {
          return { ...item, metadata: await storage.get(item.metadataUri) };
        } catch {
          return { ...item, metadata: null, metadataUnavailable: true };
        }
      }),
    );
    send(request, response, 200, { items: preparedItems });
    return;
  }

  if (method === 'POST' && path === '/org/issuances/review') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId = requiredString(body, 'organizationId');
    const reviewer = isOrganizationReviewer(organizationId, session.address);
    if (!reviewer) throw new CredoraError('Organization reviewer role required', 'FORBIDDEN', 403);
    if (typeof body.approved !== 'boolean')
      throw new CredoraError('approved must be a boolean', 'INVALID_BODY', 400);
    const approved = body.approved;
    const reviewedAt = new Date().toISOString();
    if (typeof body.batchId === 'string') {
      const batch = database
        .prepare(
          'SELECT issuer, review_status FROM issuance_batches WHERE id = ? AND organization_id = ?',
        )
        .get(body.batchId, organizationId) as { issuer: string; review_status: string } | undefined;
      if (!batch || batch.review_status !== 'pending')
        throw new CredoraError('Batch is not awaiting review', 'REVIEW_NOT_PENDING', 409);
      if (sameAddress(batch.issuer, session.address))
        throw new CredoraError('Issuers cannot approve their own batches', 'SELF_REVIEW', 403);
      if (approved) {
        const batchItems = database
          .prepare('SELECT * FROM issuances WHERE batch_id = ? ORDER BY batch_position ASC')
          .all(body.batchId) as Record<string, unknown>[];
        if (
          !batchItems.length ||
          batchItems.some(
            (item) =>
              !item.metadata_uri ||
              !item.credential_hash ||
              String(item.credential_hash).toLowerCase() !==
                hashForIssuance(item, String(item.metadata_uri)).toLowerCase(),
          )
        )
          throw new CredoraError(
            'Prepare all batch payloads before requesting review',
            'REVIEW_PAYLOAD_INCOMPLETE',
            409,
          );
      }
      database.exec('BEGIN IMMEDIATE');
      try {
        const batchUpdate = database
          .prepare(
            "UPDATE issuance_batches SET review_status = ?, state = ? WHERE id = ? AND review_status = 'pending'",
          )
          .run(approved ? 'approved' : 'rejected', approved ? 'draft' : 'rejected', body.batchId);
        if (Number(batchUpdate.changes) !== 1)
          throw new CredoraError(
            'Batch review was already recorded',
            'REVIEW_ALREADY_RECORDED',
            409,
          );
        database
          .prepare(
            `UPDATE issuances SET review_status = ?, state = ?,
             reviewed_credential_hash = CASE WHEN ? = 1 THEN credential_hash ELSE NULL END
             WHERE batch_id = ?`,
          )
          .run(
            approved ? 'approved' : 'rejected',
            approved ? 'draft' : 'rejected',
            approved ? 1 : 0,
            body.batchId,
          );
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      audit(
        session.address,
        approved ? 'organization_issuance_batch_approved' : 'organization_issuance_batch_rejected',
        {
          organizationId,
          batchId: body.batchId,
        },
      );
      send(request, response, 200, {
        batchId: body.batchId,
        reviewStatus: approved ? 'approved' : 'rejected',
      });
      return;
    }
    const issuanceId = requiredString(body, 'issuanceId');
    const issuance = database
      .prepare('SELECT * FROM issuances WHERE id = ? AND organization_id = ?')
      .get(issuanceId, organizationId) as Record<string, unknown> | undefined;
    if (!issuance || issuance.review_status !== 'pending')
      throw new CredoraError('Credential draft is not awaiting review', 'REVIEW_NOT_PENDING', 409);
    if (sameAddress(String(issuance.issuer), session.address))
      throw new CredoraError('Issuers cannot approve their own credentials', 'SELF_REVIEW', 403);
    if (
      approved &&
      (!issuance.metadata_uri ||
        !issuance.credential_hash ||
        String(issuance.credential_hash).toLowerCase() !==
          hashForIssuance(issuance, String(issuance.metadata_uri)).toLowerCase())
    )
      throw new CredoraError(
        'Prepare the credential payload before requesting review',
        'REVIEW_PAYLOAD_INCOMPLETE',
        409,
      );
    database.exec('BEGIN IMMEDIATE');
    try {
      const issuanceUpdate = database
        .prepare(
          "UPDATE issuances SET review_status = ?, state = ?, reviewed_credential_hash = ? WHERE id = ? AND review_status = 'pending'",
        )
        .run(
          approved ? 'approved' : 'rejected',
          approved ? 'draft' : 'rejected',
          approved ? String(issuance.credential_hash) : null,
          issuanceId,
        );
      if (Number(issuanceUpdate.changes) !== 1)
        throw new CredoraError(
          'Credential review was already recorded',
          'REVIEW_ALREADY_RECORDED',
          409,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    audit(
      session.address,
      approved ? 'organization_issuance_approved' : 'organization_issuance_rejected',
      {
        organizationId,
        issuanceId,
      },
    );
    send(request, response, 200, { issuanceId, reviewStatus: approved ? 'approved' : 'rejected' });
    return;
  }

  if (method === 'POST' && path === '/org/templates') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId = requiredString(body, 'organizationId');
    await requireOrganizationAdminAuthority(organizationId, session.address);
    const name = requiredString(body, 'name').normalize('NFC');
    const skillName = requiredString(body, 'skillName').normalize('NFC');
    const skillLevel = requiredString(body, 'skillLevel').normalize('NFC');
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (
      name.length > 100 ||
      skillName.length > 160 ||
      skillLevel.length > 80 ||
      description.length > 2000
    )
      throw new CredoraError('Template fields exceed their allowed length', 'INVALID_BODY', 400);
    const latestVersion = database
      .prepare(
        'SELECT MAX(version) AS version FROM credential_templates WHERE organization_id = ? AND lower(name) = lower(?)',
      )
      .get(organizationId, name) as { version: number | null };
    const version = Number(latestVersion.version ?? 0) + 1;
    const createdAt = new Date().toISOString();
    const id = randomUUID();
    database
      .prepare(
        `UPDATE credential_templates SET active = 0 WHERE organization_id = ? AND lower(name) = lower(?)`,
      )
      .run(organizationId, name);
    database
      .prepare(
        `INSERT INTO credential_templates
         (id, organization_id, name, skill_name, skill_level, description, version, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(
        id,
        organizationId,
        name,
        skillName,
        skillLevel,
        description || null,
        version,
        createdAt,
      );
    audit(session.address, 'organization_credential_template_created', {
      organizationId,
      templateId: id,
      name,
      version,
    });
    send(request, response, 201, {
      id,
      organizationId,
      name,
      skillName,
      skillLevel,
      description: description || null,
      version,
      active: 1,
      createdAt,
    });
    return;
  }

  if (method === 'POST' && path === '/org/issuer-authorizations/confirm') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId = requiredString(body, 'organizationId');
    const issuer = requiredAddress(body, 'issuer');
    if (typeof body.authorized !== 'boolean')
      throw new CredoraError('authorized must be a boolean', 'INVALID_BODY', 400);
    const authorized = body.authorized;
    const transactionHash = requiredTransactionHash(body);
    const organization = database
      .prepare(
        "SELECT id, approval_required AS approvalRequired FROM organizations WHERE id = ? AND status = 'active'",
      )
      .get(organizationId) as { id: string; approvalRequired: number } | undefined;
    if (!organization)
      throw new CredoraError('Organization is not active', 'ORGANIZATION_NOT_ACTIVE', 409);
    const { client, address } = requireOrganizationRegistry();
    let isAdmin: boolean;
    let transaction;
    let receipt;
    try {
      [isAdmin, transaction, receipt] = await Promise.all([
        client.readContract({
          address,
          abi: organizationCredentialRegistryAbi,
          functionName: 'isOrganizationAdmin',
          args: [organizationIdFromApplicationId(organizationId), session.address],
        }),
        client.getTransaction({ hash: transactionHash }),
        client.waitForTransactionReceipt({ hash: transactionHash }),
      ]);
    } catch {
      throw ledgerUnavailable();
    }
    if (!isAdmin)
      throw new CredoraError('Organization administrator role required', 'FORBIDDEN', 403);
    if (
      !transaction.to ||
      !sameAddress(transaction.to, address) ||
      !sameAddress(transaction.from, session.address) ||
      receipt.status !== 'success'
    )
      throw new CredoraError(
        'Issuer authorization transaction is not confirmed from this organization admin wallet',
        'ISSUER_AUTHORIZATION_INVALID',
        409,
      );
    let authorization;
    try {
      authorization = decodeFunctionData({
        abi: organizationCredentialRegistryAbi,
        data: transaction.input,
      });
    } catch {
      throw new CredoraError(
        'Transaction does not change issuer authorization',
        'ISSUER_AUTHORIZATION_INVALID',
        409,
      );
    }
    if (authorization.functionName !== 'setIssuerAuthorization')
      throw new CredoraError(
        'Transaction does not change issuer authorization',
        'ISSUER_AUTHORIZATION_INVALID',
        409,
      );
    const [chainOrganizationId, chainIssuer, chainAuthorized] = authorization.args;
    if (
      chainOrganizationId.toLowerCase() !==
        organizationIdFromApplicationId(organizationId).toLowerCase() ||
      !sameAddress(chainIssuer, issuer) ||
      chainAuthorized !== authorized
    )
      throw new CredoraError(
        'Issuer authorization transaction does not match the requested change',
        'ISSUER_AUTHORIZATION_MISMATCH',
        409,
      );
    const actualAuthorization = await client.readContract({
      address,
      abi: organizationCredentialRegistryAbi,
      functionName: 'isAuthorizedIssuer',
      args: [organizationIdFromApplicationId(organizationId), issuer],
    });
    if (actualAuthorization !== authorized)
      throw new CredoraError(
        'Issuer authorization has not finalized on the registry',
        'ISSUER_AUTHORIZATION_NOT_FINALIZED',
        409,
      );
    const updatedAt = new Date().toISOString();
    if (authorized) {
      database
        .prepare(
          `INSERT INTO organization_issuer_keys (organization_id, wallet_address, active, updated_at, transaction_hash)
           VALUES (?, ?, 1, ?, ?)
           ON CONFLICT(organization_id, wallet_address) DO UPDATE SET active = 1, updated_at = excluded.updated_at, transaction_hash = excluded.transaction_hash`,
        )
        .run(organizationId, issuer, updatedAt, transactionHash);
      database
        .prepare(
          `INSERT INTO organization_memberships (organization_id, wallet_address, role, status, updated_at)
           VALUES (?, ?, 'issuer', 'active', ?)
          ON CONFLICT(organization_id, wallet_address) DO UPDATE SET
            role = CASE WHEN organization_memberships.role IN ('owner', 'admin')
              THEN organization_memberships.role ELSE 'issuer' END,
            status = 'active', updated_at = excluded.updated_at`,
        )
        .run(organizationId, issuer, updatedAt);
    } else {
      database
        .prepare(
          'UPDATE organization_issuer_keys SET active = 0, updated_at = ?, transaction_hash = ? WHERE organization_id = ? AND wallet_address = ?',
        )
        .run(updatedAt, transactionHash, organizationId, issuer);
      database
        .prepare(
          "UPDATE organization_memberships SET status = 'removed', updated_at = ? WHERE organization_id = ? AND wallet_address = ? AND role = 'issuer'",
        )
        .run(updatedAt, organizationId, issuer);
    }
    audit(session.address, 'organization_issuer_authorization_changed', {
      organizationId,
      issuer,
      authorized,
      transactionHash,
    });
    send(request, response, 200, { organizationId, issuer, authorized, transactionHash });
    return;
  }

  if (method === 'POST' && path === '/org/issuer-authorizations/rotate-confirm') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId = requiredString(body, 'organizationId');
    const oldIssuer = requiredAddress(body, 'oldIssuer');
    const newIssuer = requiredAddress(body, 'newIssuer');
    const transactionHash = requiredTransactionHash(body);
    if (sameAddress(oldIssuer, newIssuer))
      throw new CredoraError('Replacement issuer wallet must be different', 'INVALID_BODY', 400);
    await requireOrganizationAdminAuthority(organizationId, session.address);
    const { client, address } = requireOrganizationRegistry();
    let transaction;
    let receipt;
    try {
      [transaction, receipt] = await Promise.all([
        client.getTransaction({ hash: transactionHash }),
        client.waitForTransactionReceipt({ hash: transactionHash }),
      ]);
    } catch {
      throw ledgerUnavailable();
    }
    if (
      !transaction.to ||
      !sameAddress(transaction.to, address) ||
      !sameAddress(transaction.from, session.address) ||
      receipt.status !== 'success'
    )
      throw new CredoraError(
        'Key rotation is not confirmed from this organization admin wallet',
        'KEY_ROTATION_INVALID',
        409,
      );
    let decoded;
    try {
      decoded = decodeFunctionData({
        abi: organizationCredentialRegistryAbi,
        data: transaction.input,
      });
    } catch {
      throw new CredoraError(
        'Transaction does not rotate an organization issuer key',
        'KEY_ROTATION_INVALID',
        409,
      );
    }
    if (decoded.functionName !== 'rotateIssuerAuthorization')
      throw new CredoraError(
        'Transaction does not rotate an organization issuer key',
        'KEY_ROTATION_INVALID',
        409,
      );
    const [chainOrganizationId, chainOldIssuer, chainNewIssuer] = decoded.args;
    if (
      chainOrganizationId.toLowerCase() !==
        organizationIdFromApplicationId(organizationId).toLowerCase() ||
      !sameAddress(chainOldIssuer, oldIssuer) ||
      !sameAddress(chainNewIssuer, newIssuer)
    )
      throw new CredoraError(
        'Rotation transaction does not match the requested issuer wallets',
        'KEY_ROTATION_MISMATCH',
        409,
      );
    const [oldAuthorized, newAuthorized] = await Promise.all([
      client.readContract({
        address,
        abi: organizationCredentialRegistryAbi,
        functionName: 'isAuthorizedIssuer',
        args: [organizationIdFromApplicationId(organizationId), oldIssuer],
      }),
      client.readContract({
        address,
        abi: organizationCredentialRegistryAbi,
        functionName: 'isAuthorizedIssuer',
        args: [organizationIdFromApplicationId(organizationId), newIssuer],
      }),
    ]);
    if (oldAuthorized || !newAuthorized)
      throw new CredoraError(
        'Issuer key rotation has not finalized on the registry',
        'KEY_ROTATION_NOT_FINALIZED',
        409,
      );
    const updatedAt = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO organization_issuer_keys (organization_id, wallet_address, active, updated_at, transaction_hash)
         VALUES (?, ?, 0, ?, ?)
         ON CONFLICT(organization_id, wallet_address) DO UPDATE SET active = 0, updated_at = excluded.updated_at, transaction_hash = excluded.transaction_hash`,
      )
      .run(organizationId, oldIssuer, updatedAt, transactionHash);
    database
      .prepare(
        `INSERT INTO organization_issuer_keys (organization_id, wallet_address, active, updated_at, transaction_hash)
         VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(organization_id, wallet_address) DO UPDATE SET active = 1, updated_at = excluded.updated_at, transaction_hash = excluded.transaction_hash`,
      )
      .run(organizationId, newIssuer, updatedAt, transactionHash);
    database
      .prepare(
        "UPDATE organization_memberships SET status = 'removed', updated_at = ? WHERE organization_id = ? AND wallet_address = ? AND role = 'issuer'",
      )
      .run(updatedAt, organizationId, oldIssuer);
    database
      .prepare(
        `INSERT INTO organization_memberships (organization_id, wallet_address, role, status, updated_at)
         VALUES (?, ?, 'issuer', 'active', ?)
         ON CONFLICT(organization_id, wallet_address) DO UPDATE SET
           role = CASE WHEN organization_memberships.role IN ('owner', 'admin')
             THEN organization_memberships.role ELSE 'issuer' END,
           status = 'active', updated_at = excluded.updated_at`,
      )
      .run(organizationId, newIssuer, updatedAt);
    audit(session.address, 'organization_issuer_key_rotated', {
      organizationId,
      oldIssuer,
      newIssuer,
      transactionHash,
    });
    send(request, response, 200, { organizationId, oldIssuer, newIssuer, transactionHash });
    return;
  }

  const organizationDecision = path.match(
    /^\/superadmin\/organization-applications\/([0-9a-f-]{36})\/(approve|reject)$/i,
  );
  if (method === 'POST' && organizationDecision) {
    const session = await requireCurrentSuperadmin(request);
    const [, applicationId, decision] = organizationDecision;
    const application = database
      .prepare(
        `SELECT id, organization_name, website_url, logo_url, applicant_address, status
      FROM organization_applications WHERE id = ?`,
      )
      .get(applicationId) as
      | {
          id: string;
          organization_name: string;
          website_url: string;
          logo_url: string | null;
          applicant_address: string;
          status: string;
        }
      | undefined;
    if (!application) throw new CredoraError('Organization request not found', 'NOT_FOUND', 404);
    if (application.status !== 'pending')
      throw new CredoraError('This request has already been reviewed', 'APPLICATION_REVIEWED', 409);
    let activationTransactionHash: Hex | undefined;
    if (decision === 'approve') {
      const body = await bodyOf(request);
      activationTransactionHash = requiredTransactionHash(body);
      const { client, address } = requireOrganizationRegistry();
      let transaction;
      let receipt;
      try {
        [transaction, receipt] = await Promise.all([
          client.getTransaction({ hash: activationTransactionHash }),
          client.waitForTransactionReceipt({ hash: activationTransactionHash }),
        ]);
      } catch {
        throw ledgerUnavailable();
      }
      if (
        !transaction.to ||
        !sameAddress(transaction.to, address) ||
        !sameAddress(transaction.from, session.address) ||
        receipt.status !== 'success'
      )
        throw new CredoraError(
          'Organization activation transaction is not a successful superadmin registry transaction',
          'ACTIVATION_TRANSACTION_INVALID',
          409,
        );
      let activation;
      try {
        activation = decodeFunctionData({
          abi: organizationCredentialRegistryAbi,
          data: transaction.input,
        });
      } catch {
        throw new CredoraError(
          'Transaction does not activate an organization',
          'ACTIVATION_TRANSACTION_INVALID',
          409,
        );
      }
      if (activation.functionName !== 'activateOrganization')
        throw new CredoraError(
          'Transaction does not activate an organization',
          'ACTIVATION_TRANSACTION_INVALID',
          409,
        );
      const [activatedId, initialAdmin] = activation.args;
      if (
        activatedId.toLowerCase() !==
          organizationIdFromApplicationId(applicationId).toLowerCase() ||
        !sameAddress(initialAdmin, application.applicant_address)
      )
        throw new CredoraError(
          'Activation transaction does not match this application and its owner wallet',
          'ACTIVATION_TRANSACTION_MISMATCH',
          409,
        );
      let onchainOrganization;
      try {
        onchainOrganization = await readOrganizationAuthority(applicationId);
      } catch {
        throw ledgerUnavailable();
      }
      if (!onchainOrganization[3] || onchainOrganization[4])
        throw new CredoraError(
          'Organization activation is not active on the registry',
          'ACTIVATION_NOT_FINALIZED',
          409,
        );
    }
    const reviewedAt = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      const updated = database
        .prepare(
          `UPDATE organization_applications SET status = ?, reviewed_at = ?, reviewed_by = ?
        WHERE id = ? AND status = 'pending'`,
        )
        .run(
          decision === 'approve' ? 'approved' : 'rejected',
          reviewedAt,
          session.address,
          applicationId,
        );
      if (Number(updated.changes) !== 1)
        throw new CredoraError(
          'This request has already been reviewed',
          'APPLICATION_REVIEWED',
          409,
        );
      if (decision === 'approve')
        database
          .prepare(
            `INSERT INTO organizations
        (id, application_id, name, website_url, admin_address, status, created_at, updated_at, logo_url)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
          )
          .run(
            applicationId,
            applicationId,
            application.organization_name,
            application.website_url,
            application.applicant_address,
            reviewedAt,
            reviewedAt,
            application.logo_url,
          );
      if (decision === 'approve') {
        database
          .prepare(
            `INSERT INTO organization_issuer_keys
             (organization_id, wallet_address, active, updated_at, transaction_hash)
             VALUES (?, ?, 1, ?, ?)`,
          )
          .run(
            applicationId,
            application.applicant_address,
            reviewedAt,
            activationTransactionHash!,
          );
        database
          .prepare(
            `INSERT INTO organization_memberships
             (organization_id, wallet_address, role, status, updated_at)
             VALUES (?, ?, 'owner', 'active', ?)`,
          )
          .run(applicationId, application.applicant_address, reviewedAt);
      }
      database
        .prepare(
          'INSERT INTO audit_logs (id, actor, action, timestamp, details) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          randomUUID(),
          session.address,
          `organization_application_${decision === 'approve' ? 'approved' : 'rejected'}`,
          reviewedAt,
          stringifyJson({
            applicationId,
            activationTransactionHash,
            applicant: application.applicant_address,
            organizationName: application.organization_name,
            websiteUrl: application.website_url,
            logoUrl: application.logo_url,
          }),
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      if (isSqliteConstraint(error))
        throw new CredoraError(
          'This wallet or organization name is already registered',
          'ORGANIZATION_CONFLICT',
          409,
        );
      throw error;
    }
    send(request, response, 200, {
      id: applicationId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      activationTransactionHash,
    });
    return;
  }

  const organizationStatus = path.match(
    /^\/superadmin\/organizations\/([0-9a-f-]{36})\/(suspend|reactivate)$/i,
  );
  if (method === 'POST' && organizationStatus) {
    const session = await requireCurrentSuperadmin(request);
    const [, organizationId, action] = organizationStatus;
    const status = action === 'suspend' ? 'suspended' : 'active';
    const body = await bodyOf(request);
    const transactionHash = requiredTransactionHash(body);
    const { client, address } = requireOrganizationRegistry();
    let transaction;
    let receipt;
    try {
      [transaction, receipt] = await Promise.all([
        client.getTransaction({ hash: transactionHash }),
        client.waitForTransactionReceipt({ hash: transactionHash }),
      ]);
    } catch {
      throw ledgerUnavailable();
    }
    if (
      !transaction.to ||
      !sameAddress(transaction.to, address) ||
      !sameAddress(transaction.from, session.address) ||
      receipt.status !== 'success'
    )
      throw new CredoraError(
        'Organization status transaction is not a successful superadmin registry transaction',
        'ORGANIZATION_STATUS_TRANSACTION_INVALID',
        409,
      );
    let statusChange;
    try {
      statusChange = decodeFunctionData({
        abi: organizationCredentialRegistryAbi,
        data: transaction.input,
      });
    } catch {
      throw new CredoraError(
        'Transaction does not change organization status',
        'ORGANIZATION_STATUS_TRANSACTION_INVALID',
        409,
      );
    }
    if (statusChange.functionName !== 'setOrganizationSuspended')
      throw new CredoraError(
        'Transaction does not change organization status',
        'ORGANIZATION_STATUS_TRANSACTION_INVALID',
        409,
      );
    const [chainOrganizationId, suspended] = statusChange.args;
    if (
      chainOrganizationId.toLowerCase() !==
        organizationIdFromApplicationId(organizationId).toLowerCase() ||
      suspended !== (action === 'suspend')
    )
      throw new CredoraError(
        'Status transaction does not match this organization and action',
        'ORGANIZATION_STATUS_TRANSACTION_MISMATCH',
        409,
      );
    const chainOrganization = await readOrganizationAuthority(organizationId);
    if (!chainOrganization[3] || chainOrganization[4] !== (action === 'suspend'))
      throw new CredoraError(
        'Organization status has not finalized on the registry',
        'ORGANIZATION_STATUS_NOT_FINALIZED',
        409,
      );
    const updated = database
      .prepare('UPDATE organizations SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), organizationId);
    if (Number(updated.changes) !== 1)
      throw new CredoraError('Organization not found', 'NOT_FOUND', 404);
    audit(
      session.address,
      action === 'suspend' ? 'organization_suspended' : 'organization_reactivated',
      { organizationId },
    );
    send(request, response, 200, { id: organizationId, status });
    return;
  }

  if (method === 'GET' && path === '/superadmin/overview') {
    const session = await requireCurrentSuperadmin(request);
    const issuanceCount = database.prepare('SELECT COUNT(*) AS count FROM issuances').get() as {
      count: number;
    };
    const confirmedCount = database
      .prepare("SELECT COUNT(*) AS count FROM issuances WHERE state = 'confirmed'")
      .get() as { count: number };
    const auditCount = database.prepare('SELECT COUNT(*) AS count FROM audit_logs').get() as {
      count: number;
    };
    send(request, response, 200, {
      address: session.address,
      roles: session.roles,
      ledger: {
        configured: Boolean(blockchain),
        chainId: configuredChainId,
        registryAddress: registryAddress ?? null,
        organizationRegistryConfigured: Boolean(organizationRegistryAddress),
        organizationRegistryAddress: organizationRegistryAddress ?? null,
      },
      projections: {
        issuances: Number(issuanceCount.count),
        confirmed: Number(confirmedCount.count),
        auditEvents: Number(auditCount.count),
      },
      metrics: Object.fromEntries(metrics),
    });
    return;
  }

  if (method === 'POST' && path === '/issuances/bulk') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId = requiredString(body, 'organizationId');
    const idempotencyKey = requiredString(body, 'idempotencyKey');
    if (idempotencyKey.length > 128)
      throw new CredoraError('idempotencyKey must be at most 128 characters', 'INVALID_BODY', 400);
    if (
      !Array.isArray(body.recipients) ||
      body.recipients.length < 1 ||
      body.recipients.length > 100
    )
      throw new CredoraError(
        'A batch must contain between 1 and 100 recipients',
        'INVALID_BODY',
        400,
      );
    const organization = database
      .prepare(
        "SELECT id, approval_required AS approvalRequired FROM organizations WHERE id = ? AND status = 'active'",
      )
      .get(organizationId) as { id: string; approvalRequired: number } | undefined;
    if (!organization)
      throw new CredoraError('Organization is not active', 'ORGANIZATION_NOT_ACTIVE', 409);
    let authorized = false;
    try {
      authorized = await isOrganizationIssuer(organizationId, session.address);
    } catch {
      throw ledgerUnavailable();
    }
    if (!authorized)
      throw new CredoraError(
        'This wallet is not authorized to issue for the organization',
        'FORBIDDEN',
        403,
      );
    const requiresReview = Boolean(organization.approvalRequired);
    const skillName = requiredString(body, 'skillName');
    const skillLevel = requiredString(body, 'skillLevel');
    const issueDate = requiredIssueDate(body);
    const learners = body.recipients.map((value, index) => {
      if (typeof value !== 'string')
        throw new CredoraError(
          `recipients[${index}] must be a wallet address`,
          'INVALID_BODY',
          400,
        );
      try {
        return normalizeAddress(value, `recipients[${index}]`);
      } catch {
        throw new CredoraError(
          `recipients[${index}] must be a wallet address`,
          'INVALID_BODY',
          400,
        );
      }
    });
    if (new Set(learners.map((address) => address.toLowerCase())).size !== learners.length)
      throw new CredoraError(
        'Batch contains duplicate wallet addresses',
        'DUPLICATE_RECIPIENT',
        400,
      );
    const existingBatch = database
      .prepare(
        'SELECT id, state, review_status AS reviewStatus, transaction_hash AS transactionHash FROM issuance_batches WHERE organization_id = ? AND issuer = ? AND idempotency_key = ?',
      )
      .get(organizationId, session.address, idempotencyKey) as
      | { id: string; state: string; reviewStatus: string; transactionHash: string | null }
      | undefined;
    if (existingBatch) {
      const items = database
        .prepare('SELECT * FROM issuances WHERE batch_id = ? ORDER BY batch_position ASC')
        .all(existingBatch.id);
      send(request, response, 200, { ...existingBatch, items, reused: true });
      return;
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `INSERT INTO issuance_batches
           (id, organization_id, issuer, idempotency_key, state, created_at, review_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          organizationId,
          session.address,
          idempotencyKey,
          requiresReview ? 'review-pending' : 'draft',
          createdAt,
          requiresReview ? 'pending' : 'approved',
        );
      const insert = database.prepare(
        `INSERT INTO issuances
         (id, issuer, learner, skill_name, skill_level, issue_date, state, created_at,
          organization_id, batch_id, batch_position, review_status)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
      );
      learners.forEach((learner, index) =>
        insert.run(
          randomUUID(),
          session.address,
          learner,
          skillName,
          skillLevel,
          issueDate,
          createdAt,
          organizationId,
          id,
          index,
          requiresReview ? 'pending' : 'approved',
        ),
      );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      if (isSqliteConstraint(error))
        throw new CredoraError('This idempotency key already has a batch', 'BATCH_CONFLICT', 409);
      throw error;
    }
    audit(session.address, 'organization_issuance_batch_created', {
      batchId: id,
      organizationId,
      recipients: learners.length,
      reviewStatus: requiresReview ? 'pending' : 'approved',
    });
    const items = database
      .prepare('SELECT * FROM issuances WHERE batch_id = ? ORDER BY batch_position ASC')
      .all(id);
    send(request, response, 201, {
      id,
      state: requiresReview ? 'review-pending' : 'draft',
      reviewStatus: requiresReview ? 'pending' : 'approved',
      items,
      reused: false,
    });
    return;
  }

  if (method === 'POST' && path === '/issuances/bulk/confirm') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const batchId = requiredString(body, 'batchId');
    const transactionHash = requiredTransactionHash(body);
    const batch = database.prepare('SELECT * FROM issuance_batches WHERE id = ?').get(batchId) as
      Record<string, unknown> | undefined;
    if (!batch) throw new CredoraError('Issuance batch not found', 'NOT_FOUND', 404);
    if (!sameAddress(String(batch.issuer), session.address))
      throw new CredoraError('Issuance batch belongs to another issuer', 'FORBIDDEN', 403);
    if (batch.review_status !== 'approved')
      throw new CredoraError('This batch is awaiting organization review', 'REVIEW_PENDING', 409);
    const items = database
      .prepare('SELECT * FROM issuances WHERE batch_id = ? ORDER BY batch_position ASC')
      .all(batchId) as Record<string, unknown>[];
    if (!items.length || items.some((item) => !item.credential_hash || !item.metadata_uri))
      throw new CredoraError(
        'Upload metadata for every batch item before signing',
        'INVALID_STATE',
        409,
      );
    const { client, address } = requireOrganizationRegistry();
    let transaction;
    let receipt;
    try {
      [transaction, receipt] = await Promise.all([
        client.getTransaction({ hash: transactionHash }),
        client.waitForTransactionReceipt({ hash: transactionHash }),
      ]);
    } catch {
      database
        .prepare("UPDATE issuance_batches SET state = 'transaction-pending' WHERE id = ?")
        .run(batchId);
      throw ledgerUnavailable();
    }
    if (receipt.status === 'reverted') {
      database
        .prepare("UPDATE issuance_batches SET state = 'transaction-reverted' WHERE id = ?")
        .run(batchId);
      throw new CredoraError(
        'The batch transaction reverted on the registry',
        'TRANSACTION_REVERTED',
        409,
      );
    }
    if (
      !transaction.to ||
      !sameAddress(transaction.to, address) ||
      !sameAddress(transaction.from, session.address)
    )
      throw new CredoraError(
        'Transaction is not from this issuer to the organization registry',
        'INTEGRITY_MISMATCH',
        409,
      );
    let decoded;
    try {
      decoded = decodeFunctionData({
        abi: organizationCredentialRegistryAbi,
        data: transaction.input,
      });
    } catch {
      throw new CredoraError(
        'Transaction is not an organization issuance batch',
        'INTEGRITY_MISMATCH',
        409,
      );
    }
    if (decoded.functionName !== 'issueCredentials')
      throw new CredoraError(
        'Transaction is not an organization issuance batch',
        'INTEGRITY_MISMATCH',
        409,
      );
    const [chainOrganizationId, hashes, learners, metadataUris] = decoded.args;
    let onchainRecords;
    try {
      onchainRecords = await Promise.all(
        items.map((item) =>
          client.readContract({
            address,
            abi: organizationCredentialRegistryAbi,
            functionName: 'getCredential',
            args: [String(item.credential_hash) as Hex],
          }),
        ),
      );
    } catch {
      database
        .prepare("UPDATE issuance_batches SET state = 'transaction-pending' WHERE id = ?")
        .run(batchId);
      throw ledgerUnavailable();
    }
    const expectedOrganizationId = organizationIdFromApplicationId(String(batch.organization_id));
    const matchesBatch =
      chainOrganizationId.toLowerCase() === expectedOrganizationId.toLowerCase() &&
      hashes.length === items.length &&
      hashes.every(
        (hash, index) =>
          hash.toLowerCase() === String(items[index].credential_hash).toLowerCase() &&
          sameAddress(learners[index], String(items[index].learner)) &&
          metadataUris[index] === String(items[index].metadata_uri),
      );
    const recordsMatch = onchainRecords.every(
      (record, index) =>
        record[5] &&
        record[0].toLowerCase() === expectedOrganizationId.toLowerCase() &&
        sameAddress(record[1], session.address) &&
        sameAddress(record[2], String(items[index].learner)) &&
        record[3] === String(items[index].metadata_uri),
    );
    const reviewedPayloadsMatch = items.every(
      (item) =>
        !item.reviewed_credential_hash ||
        String(item.reviewed_credential_hash).toLowerCase() ===
          String(item.credential_hash).toLowerCase(),
    );
    if (!matchesBatch || !recordsMatch || !reviewedPayloadsMatch)
      throw new CredoraError(
        'Confirmed batch does not match its frozen issuance payloads',
        'INTEGRITY_MISMATCH',
        409,
      );
    database.exec('BEGIN IMMEDIATE');
    try {
      const update = database.prepare(
        "UPDATE issuances SET transaction_hash = ?, block_number = ?, state = 'confirmed' WHERE id = ?",
      );
      items.forEach((item) =>
        update.run(transactionHash, Number(receipt.blockNumber), String(item.id)),
      );
      database
        .prepare(
          "UPDATE issuance_batches SET state = 'confirmed', transaction_hash = ? WHERE id = ?",
        )
        .run(transactionHash, batchId);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    audit(session.address, 'organization_issuance_batch_confirmed', {
      batchId,
      transactionHash,
      credentials: items.length,
      blockNumber: receipt.blockNumber,
    });
    send(request, response, 200, {
      id: batchId,
      state: 'confirmed',
      transactionHash,
      blockNumber: receipt.blockNumber,
      credentialHashes: hashes,
    });
    return;
  }

  if (method === 'POST' && path === '/issuances') {
    const session = requireSession(request);
    const body = await bodyOf(request);
    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId : undefined;
    let requiresReview = false;
    if (organizationId) {
      const organization = database
        .prepare(
          "SELECT id, approval_required AS approvalRequired FROM organizations WHERE id = ? AND status = 'active'",
        )
        .get(organizationId) as { id: string; approvalRequired: number } | undefined;
      if (!organization)
        throw new CredoraError('Organization is not active', 'ORGANIZATION_NOT_ACTIVE', 409);
      let authorized = false;
      try {
        authorized = await isOrganizationIssuer(organization.id, session.address);
      } catch {
        throw ledgerUnavailable();
      }
      if (!authorized)
        throw new CredoraError(
          'The connected wallet is not authorized to issue for this organization',
          'FORBIDDEN',
          403,
        );
      requiresReview = Boolean(organization.approvalRequired);
    } else {
      const registry = requireLedger();
      let authorized: boolean;
      try {
        authorized = await registry.isIssuerAuthorized(session.address);
      } catch {
        throw ledgerUnavailable();
      }
      if (!authorized)
        throw new CredoraError(
          'The connected wallet is not an authorized issuer',
          'FORBIDDEN',
          403,
        );
    }
    const learner = requiredAddress(body, 'learnerAddress');
    const skillName = requiredString(body, 'skillName');
    const skillLevel = requiredString(body, 'skillLevel');
    const issueDate = requiredIssueDate(body);
    const id = randomUUID();
    const state: OperationState = 'draft';
    database
      .prepare(
        `
        INSERT INTO issuances
        (id, issuer, learner, skill_name, skill_level, issue_date, state, created_at, organization_id, review_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        session.address,
        learner,
        skillName,
        skillLevel,
        issueDate,
        state,
        new Date().toISOString(),
        organizationId ??
          (
            database
              .prepare("SELECT id FROM organizations WHERE admin_address = ? AND status = 'active'")
              .get(session.address) as { id: string } | undefined
          )?.id ??
          null,
        requiresReview ? 'pending' : 'approved',
      );
    audit(session.address, 'issuance_draft_created', {
      id,
      learner,
      skillName,
      skillLevel,
      reviewStatus: requiresReview ? 'pending' : 'approved',
    });
    send(request, response, 201, {
      id,
      state,
      issuerAddress: session.address,
      learnerAddress: learner,
      skillName,
      skillLevel,
      issueDate,
      reviewStatus: requiresReview ? 'pending' : 'approved',
    });
    return;
  }

  const issuanceMatch = path.match(/^\/issuances\/([^/]+)(?:\/(metadata|confirm|image))?$/);
  if (issuanceMatch) {
    const session = requireSession(request);
    const id = issuanceMatch[1];
    const row = database.prepare('SELECT * FROM issuances WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    if (!row) throw new CredoraError('Issuance operation not found', 'NOT_FOUND', 404);
    if (row.issuer !== session.address)
      throw new CredoraError('Issuance belongs to another issuer', 'FORBIDDEN', 403);

    if (method === 'GET' && !issuanceMatch[2]) {
      send(request, response, 200, row);
      return;
    }

    if (method === 'POST' && issuanceMatch[2] === 'image') {
      if (row.state === 'confirmed')
        throw new CredoraError('Issued credentials are immutable', 'IMMUTABLE_CREDENTIAL', 409);
      const body = await bodyOf(request, maxImageBodyBytes);
      const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
      const match = dataUrl.match(
        /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
      );
      if (!match) throw new CredoraError('Upload a PNG, JPG, or WebP image', 'INVALID_IMAGE', 400);
      const bytes = Buffer.from(match[2], 'base64');
      if (
        bytes.length > 5 * 1024 * 1024 ||
        bytes.toString('base64') !== match[2] ||
        !imageTypeIsValid(bytes, match[1])
      )
        throw new CredoraError(
          'The image is invalid or exceeds the 5 MB limit',
          'INVALID_IMAGE',
          400,
        );
      let stored: { uri: string; cid: string };
      try {
        stored = await storage.putAsset(bytes, match[1]);
      } catch {
        throw new CredoraError('Image storage is unavailable', 'ASSET_STORAGE_UNAVAILABLE', 503);
      }
      audit(session.address, 'issuance_image_uploaded', { id, cid: stored.cid });
      send(request, response, 201, stored);
      return;
    }

    if (method === 'POST' && issuanceMatch[2] === 'metadata') {
      const body = await bodyOf(request);
      if (row.state === 'confirmed')
        throw new CredoraError('Issued credentials are immutable', 'IMMUTABLE_CREDENTIAL', 409);
      if (row.reviewed_credential_hash)
        throw new CredoraError(
          'This payload has been approved and cannot be changed. Create a new issuance for edits.',
          'REVIEWED_PAYLOAD_IMMUTABLE',
          409,
        );
      if (
        body.imageUri !== undefined &&
        (typeof body.imageUri !== 'string' ||
          !/^(?:ipfs|local):\/\/[A-Za-z0-9_-]{8,128}$/.test(body.imageUri))
      )
        throw new CredoraError('The credential image reference is invalid', 'INVALID_IMAGE', 400);
      const metadata: CredentialMetadata | OrganizationCredentialMetadata = row.organization_id
        ? {
            schemaVersion: 3,
            organizationId: organizationIdFromApplicationId(String(row.organization_id)),
            skillName: String(row.skill_name),
            skillLevel: String(row.skill_level),
            issueDate: normalizeIssueDate(String(row.issue_date)),
            issuerAddress: session.address as `0x${string}`,
            learnerAddress: String(row.learner) as `0x${string}`,
            description: typeof body.description === 'string' ? body.description : undefined,
            imageUri: typeof body.imageUri === 'string' ? body.imageUri : undefined,
          }
        : {
            schemaVersion: 1,
            skillName: String(row.skill_name),
            skillLevel: String(row.skill_level),
            issueDate: normalizeIssueDate(String(row.issue_date)),
            issuerAddress: session.address as `0x${string}`,
            learnerAddress: String(row.learner) as `0x${string}`,
            description: typeof body.description === 'string' ? body.description : undefined,
            imageUri: typeof body.imageUri === 'string' ? body.imageUri : undefined,
          };
      let stored: { uri: string; cid: string };
      try {
        stored = await storage.put(metadata);
      } catch {
        updateIssuanceState(id, 'metadata-upload-failed');
        audit(session.address, 'issuance_metadata_upload_failed', { id });
        throw new CredoraError(
          'Credential metadata storage is unavailable',
          'METADATA_STORAGE_UNAVAILABLE',
          503,
        );
      }
      const credentialHash = hashForIssuance(row, stored.uri);
      const updated = database
        .prepare(
          'UPDATE issuances SET metadata_uri = ?, credential_hash = ?, state = ? WHERE id = ? AND reviewed_credential_hash IS NULL',
        )
        .run(stored.uri, credentialHash, 'metadata-uploaded', id);
      if (Number(updated.changes) !== 1)
        throw new CredoraError(
          'This payload was approved while metadata was uploading. Prepare a new issuance to change it.',
          'REVIEWED_PAYLOAD_IMMUTABLE',
          409,
        );
      audit(session.address, 'issuance_metadata_uploaded', { id, uri: stored.uri });
      send(request, response, 200, { id, state: 'metadata-uploaded', credentialHash, ...stored });
      return;
    }

    if (method === 'POST' && issuanceMatch[2] === 'confirm') {
      const body = await bodyOf(request);
      if (row.state === 'confirmed')
        throw new CredoraError('Issued credentials are immutable', 'IMMUTABLE_CREDENTIAL', 409);
      const transactionHash = requiredTransactionHash(body);
      const credentialHash = requiredHash(body, 'credentialHash');
      if (!row.metadata_uri || !row.credential_hash)
        throw new CredoraError('Credential metadata must be uploaded first', 'INVALID_STATE', 409);
      const expectedHash = hashForIssuance(row, String(row.metadata_uri));
      if (
        expectedHash.toLowerCase() !== credentialHash.toLowerCase() ||
        String(row.credential_hash).toLowerCase() !== expectedHash.toLowerCase()
      )
        throw new CredoraError(
          'Credential hash does not match the canonical issuance payload',
          'INTEGRITY_MISMATCH',
          409,
        );
      if (
        row.reviewed_credential_hash &&
        String(row.reviewed_credential_hash).toLowerCase() !== expectedHash.toLowerCase()
      )
        throw new CredoraError(
          'Credential payload differs from the version approved by its reviewer',
          'REVIEWED_PAYLOAD_MISMATCH',
          409,
        );
      if (row.review_status === 'pending')
        throw new CredoraError(
          'This credential is prepared and waiting for organization review before signing',
          'REVIEW_PENDING',
          409,
        );
      if (row.review_status === 'rejected')
        throw new CredoraError(
          'This credential draft was rejected by an organization reviewer',
          'REVIEW_REJECTED',
          409,
        );
      let receipt;
      let issuanceMatches = false;
      if (row.organization_id) {
        const { client, address } = requireOrganizationRegistry();
        let transaction;
        let organizationCredential;
        try {
          [transaction, receipt, organizationCredential] = await Promise.all([
            client.getTransaction({ hash: transactionHash }),
            client.waitForTransactionReceipt({ hash: transactionHash }),
            client.readContract({
              address,
              abi: organizationCredentialRegistryAbi,
              functionName: 'getCredential',
              args: [credentialHash],
            }),
          ]);
          const decoded =
            transaction?.to && sameAddress(transaction.to, address)
              ? decodeFunctionData({
                  abi: organizationCredentialRegistryAbi,
                  data: transaction.input,
                })
              : undefined;
          if (decoded?.functionName === 'issueCredential') {
            const [orgId, hash, learner, metadataUri] = decoded.args;
            issuanceMatches =
              sameAddress(transaction!.from, session.address) &&
              orgId.toLowerCase() ===
                organizationIdFromApplicationId(String(row.organization_id)).toLowerCase() &&
              hash.toLowerCase() === credentialHash.toLowerCase() &&
              sameAddress(learner, String(row.learner)) &&
              metadataUri === String(row.metadata_uri) &&
              organizationCredential[5] &&
              organizationCredential[0].toLowerCase() === orgId.toLowerCase() &&
              sameAddress(organizationCredential[1], session.address) &&
              sameAddress(organizationCredential[2], String(row.learner)) &&
              organizationCredential[3] === String(row.metadata_uri);
          }
        } catch {
          updateIssuanceState(id, 'transaction-pending');
          throw ledgerUnavailable();
        }
      } else {
        const registry = requireLedger();
        try {
          receipt = await registry.waitForConfirmation(transactionHash);
        } catch {
          updateIssuanceState(id, 'transaction-pending');
          throw ledgerUnavailable();
        }
        if (receipt.status === 'success') {
          let transaction;
          let onchain;
          try {
            transaction = await registry.getIssuanceTransaction(transactionHash);
            onchain = await registry.getCredential(credentialHash);
          } catch {
            updateIssuanceState(id, 'transaction-pending');
            throw ledgerUnavailable();
          }
          issuanceMatches = Boolean(
            onchain.state !== 'not-found' &&
            transaction &&
            sameAddress(transaction.from, session.address) &&
            sameAddress(transaction.learner, String(row.learner)) &&
            transaction.metadataUri === String(row.metadata_uri) &&
            sameAddress(onchain.issuer ?? '', session.address) &&
            sameAddress(onchain.learner ?? '', String(row.learner)) &&
            onchain.metadataUri === String(row.metadata_uri),
          );
        }
      }
      if (receipt.status === 'reverted') {
        updateIssuanceState(id, 'transaction-reverted');
        audit(session.address, 'credential_issuance_transaction_reverted', {
          id,
          transactionHash,
        });
        send(request, response, 409, {
          id,
          state: 'transaction-reverted',
          transactionHash,
          credentialHash,
          blockNumber: receipt.blockNumber,
        });
        return;
      }

      if (!issuanceMatches)
        throw new CredoraError(
          'The confirmed transaction did not issue this credential',
          'INTEGRITY_MISMATCH',
          409,
        );
      database
        .prepare(
          'UPDATE issuances SET transaction_hash = ?, credential_hash = ?, block_number = ?, state = ? WHERE id = ?',
        )
        .run(transactionHash, credentialHash, receipt.blockNumber.toString(), 'confirmed', id);
      audit(session.address, 'credential_issuance_confirmed', {
        id,
        transactionHash,
        blockNumber: receipt.blockNumber,
      });
      send(request, response, 200, {
        id,
        state: 'confirmed',
        transactionHash,
        credentialHash,
        blockNumber: receipt.blockNumber,
      });
      return;
    }
  }

  const verifyMatch = path.match(/^\/credentials\/([^/]+)\/verify$/);
  if (method === 'GET' && verifyMatch) {
    let reference: Hex;
    try {
      reference = credentialReferenceFromHash(decodeURIComponent(verifyMatch[1]));
    } catch {
      throw new CredoraError(
        'Credential reference must be a 32-byte hash',
        'MALFORMED_REFERENCE',
        400,
      );
    }
    if (organizationPublicClient && organizationRegistryAddress) {
      let organizationCredential;
      try {
        organizationCredential = await organizationPublicClient.readContract({
          address: organizationRegistryAddress,
          abi: organizationCredentialRegistryAbi,
          functionName: 'getCredential',
          args: [reference],
        });
      } catch {
        throw ledgerUnavailable();
      }
      const [organizationId, issuer, learner, metadataUri, issuedAt, exists] =
        organizationCredential;
      if (exists) {
        const record = {
          credentialHash: reference,
          organizationId,
          issuer,
          learner,
          metadataUri,
          issuedAt,
          protocolVersion: 3,
        };
        let metadata;
        try {
          metadata = await storage.get(metadataUri);
        } catch {
          send(request, response, 503, {
            ...record,
            state: 'metadata-unavailable',
            message: 'Credential proof found, but metadata is temporarily unavailable.',
          });
          return;
        }
        if (metadata.schemaVersion !== 3) {
          send(request, response, 422, {
            ...record,
            state: 'metadata-invalid',
            message: 'Organization credential metadata does not match protocol version 3.',
          });
          return;
        }
        let currentOrganization;
        try {
          currentOrganization = await organizationPublicClient.readContract({
            address: organizationRegistryAddress,
            abi: organizationCredentialRegistryAbi,
            functionName: 'getOrganization',
            args: [organizationId],
          });
        } catch {
          throw ledgerUnavailable();
        }
        const metadataMatches =
          metadata.organizationId.toLowerCase() === organizationId.toLowerCase() &&
          hashOrganizationCredential({
            organizationId,
            issuerAddress: metadata.issuerAddress,
            learnerAddress: metadata.learnerAddress,
            skillName: metadata.skillName,
            skillLevel: metadata.skillLevel,
            issueDate: metadata.issueDate,
            metadataUri,
          }).toLowerCase() === reference.toLowerCase() &&
          (!metadata.credentialHash ||
            metadata.credentialHash.toLowerCase() === reference.toLowerCase()) &&
          sameAddress(metadata.issuerAddress, issuer) &&
          sameAddress(metadata.learnerAddress, learner);
        if (!metadataMatches) {
          send(request, response, 422, {
            ...record,
            state: 'metadata-invalid',
            message: 'Credential proof found, but the metadata does not match the ledger record.',
          });
          return;
        }
        send(request, response, 200, {
          ...record,
          state: 'valid',
          metadata,
          organizationStatus: currentOrganization[4] ? 'suspended' : 'active',
          message: 'Organization-bound credential verified against the immutable ledger.',
        });
        return;
      }
    }
    const registry = requireLedger();
    let record;
    try {
      record = await registry.getCredential(reference);
    } catch {
      throw ledgerUnavailable();
    }
    if (record.state === 'not-found') {
      send(request, response, 200, {
        ...record,
        message: 'No credential with this reference exists on the selected ledger.',
      });
      return;
    }
    if (!record.metadataUri || !record.issuer || !record.learner) throw ledgerUnavailable();

    let metadata;
    try {
      metadata = await storage.get(record.metadataUri);
    } catch {
      send(request, response, 503, {
        ...record,
        state: 'metadata-unavailable',
        message: 'Credential proof found, but metadata is temporarily unavailable.',
      });
      return;
    }
    if (metadata.schemaVersion !== 1) {
      send(request, response, 422, {
        ...record,
        state: 'metadata-invalid',
        message: 'Credential metadata version does not match the selected registry protocol.',
      });
      return;
    }
    if (
      hashCredential({
        issuerAddress: metadata.issuerAddress,
        learnerAddress: metadata.learnerAddress,
        skillName: metadata.skillName,
        skillLevel: metadata.skillLevel,
        issueDate: metadata.issueDate,
        metadataUri: record.metadataUri,
      }).toLowerCase() !== reference.toLowerCase() ||
      (metadata.credentialHash &&
        metadata.credentialHash.toLowerCase() !== reference.toLowerCase()) ||
      !sameAddress(metadata.issuerAddress, record.issuer ?? '') ||
      !sameAddress(metadata.learnerAddress, record.learner ?? '')
    ) {
      send(request, response, 422, {
        ...record,
        state: 'metadata-invalid',
        message: 'Credential proof found, but the metadata does not match the ledger record.',
      });
      return;
    }
    send(request, response, 200, {
      ...record,
      state: 'valid',
      metadata,
      message: 'Credential verified against the immutable ledger.',
    });
    return;
  }

  if (method === 'GET' && path === '/admin/audit') {
    const session = requireSession(request);
    if (!isSuperadmin(session))
      throw new CredoraError('Superadmin role required', 'FORBIDDEN', 403);
    const limitValue = Number(url.searchParams.get('limit') ?? 100);
    const offsetValue = Number(url.searchParams.get('offset') ?? 0);
    if (
      !Number.isInteger(limitValue) ||
      limitValue < 1 ||
      limitValue > 500 ||
      !Number.isInteger(offsetValue) ||
      offsetValue < 0
    )
      throw new CredoraError(
        'limit must be 1-500 and offset must be a non-negative integer',
        'INVALID_QUERY',
        400,
      );
    const items = database
      .prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?')
      .all(limitValue, offsetValue)
      .map((entry) => {
        const row = entry as Record<string, unknown>;
        try {
          return { ...row, details: JSON.parse(String(row.details)) };
        } catch {
          return row;
        }
      });
    const countRow = database.prepare('SELECT COUNT(*) AS count FROM audit_logs').get() as {
      count: number;
    };
    const total = Number(countRow.count);
    send(request, response, 200, { items, total, limit: limitValue, offset: offsetValue });
    return;
  }

  if (method === 'POST' && path === '/admin/reconcile') {
    const session = requireSession(request);
    if (!isSuperadmin(session))
      throw new CredoraError('Superadmin role required', 'FORBIDDEN', 403);
    const body = await bodyOf(request);
    let fromBlock: bigint | undefined;
    if (body.fromBlock !== undefined) {
      if (
        typeof body.fromBlock !== 'number' ||
        !Number.isInteger(body.fromBlock) ||
        body.fromBlock < 0
      )
        throw new CredoraError('fromBlock must be a non-negative integer', 'INVALID_BODY', 400);
      fromBlock = BigInt(body.fromBlock);
    }
    try {
      const result = await reconcileChainEvents(fromBlock);
      const organizationResult = await reconcileOrganizationCredentialEvents(fromBlock);
      audit(session.address, 'chain_reconciliation_requested', {
        fromBlock: fromBlock?.toString(),
      });
      send(request, response, 200, {
        ...result,
        organizationRegistry: organizationResult,
        events: Number(result.events ?? 0) + Number(organizationResult.events ?? 0),
      });
    } catch {
      throw ledgerUnavailable();
    }
    return;
  }

  if (method === 'GET' && path === '/admin/issuers') {
    const session = requireSession(request);
    if (!isSuperadmin(session))
      throw new CredoraError('Superadmin role required', 'FORBIDDEN', 403);
    const requested = url.searchParams.getAll('address');
    const addresses = requested.length
      ? requested.map((address) => normalizeAddress(address, 'address'))
      : [...configuredSuperadminAddresses].map((address) => normalizeAddress(address, 'address'));
    if (!blockchain)
      throw new CredoraError('Credential ledger is not configured', 'LEDGER_UNAVAILABLE', 503);
    try {
      const issuers = await Promise.all(
        addresses.map(async (address) => ({
          address,
          authorized: await blockchain.isIssuerAuthorized(address),
        })),
      );
      send(request, response, 200, { issuers });
    } catch {
      throw ledgerUnavailable();
    }
    return;
  }

  if (method === 'POST' && path === '/admin/issuer-authorizations/confirm') {
    const session = requireSession(request);
    if (!isSuperadmin(session))
      throw new CredoraError('Superadmin role required', 'FORBIDDEN', 403);
    const body = await bodyOf(request);
    const transactionHash = requiredTransactionHash(body);
    const issuer = requiredAddress(body, 'issuer');
    if (typeof body.authorized !== 'boolean')
      throw new CredoraError('authorized must be a boolean', 'INVALID_BODY', 400);
    const registry = requireLedger();
    let receipt;
    try {
      receipt = await registry.waitForConfirmation(transactionHash);
    } catch {
      throw ledgerUnavailable();
    }
    if (receipt.status === 'reverted') {
      send(request, response, 409, {
        state: 'transaction-reverted',
        transactionHash,
        blockNumber: receipt.blockNumber,
      });
      return;
    }
    let transaction;
    let authorized;
    try {
      transaction = await registry.getIssuerAuthorizationTransaction(transactionHash);
      if (
        !transaction ||
        !sameAddress(transaction.issuer, issuer) ||
        transaction.authorized !== body.authorized ||
        !(await registry.isAdmin(transaction.from))
      )
        throw new CredoraError(
          'The authorization transaction does not match an admin action',
          'INTEGRITY_MISMATCH',
          409,
        );
      authorized = await registry.isIssuerAuthorized(issuer);
    } catch (error) {
      if (error instanceof CredoraError) throw error;
      throw ledgerUnavailable();
    }
    if (authorized !== body.authorized)
      throw new CredoraError(
        'Issuer authorization was not reflected on the ledger',
        'LEDGER_UNAVAILABLE',
        503,
      );
    audit(session.address, 'issuer_authorization_confirmed', {
      issuer,
      authorized,
      transactionHash,
      blockNumber: receipt.blockNumber,
    });
    send(request, response, 200, {
      issuer,
      authorized,
      transactionHash,
      blockNumber: receipt.blockNumber,
    });
    return;
  }

  throw new CredoraError('Route not found', 'NOT_FOUND', 404);
}

const server = createServer((request, response) => {
  incrementMetric('api_requests_total');
  route(request, response).catch((error) => fail(request, response, error));
});

server.listen(port, () => {
  console.log(JSON.stringify({ level: 'info', event: 'api_started', port }));
});

const cleanupTimer = setInterval(cleanupExpiredData, cleanupIntervalMs);
cleanupTimer.unref();
const chainSyncTimer = setInterval(() => {
  Promise.allSettled([reconcileChainEvents(), reconcileOrganizationCredentialEvents()]).catch(
    () => undefined,
  );
}, chainSyncIntervalMs);
chainSyncTimer.unref();

process.on('SIGINT', () =>
  server.close(() => {
    clearInterval(cleanupTimer);
    clearInterval(chainSyncTimer);
    database.close();
  }),
);
process.on('SIGTERM', () =>
  server.close(() => {
    clearInterval(cleanupTimer);
    clearInterval(chainSyncTimer);
    database.close();
  }),
);
