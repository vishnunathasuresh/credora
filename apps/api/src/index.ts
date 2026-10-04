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
  normalizeAddress,
  normalizeIssueDate,
  type CredentialMetadata,
} from '@credora/credential-core';
import {
  createCredoraPublicClient,
  RegistryBlockchainAdapter,
  type BlockchainAdapter,
} from '@credora/blockchain';
import { demoCatalog } from '@credora/demo-data';
import { CredoraError, isRecord, type OperationState, type Role } from '@credora/shared';
import { FileStorage, IpfsStorage, type MetadataStorage } from '@credora/storage';
import { defineChain, isAddress, type Address, type Hex } from 'viem';

const port = Number(process.env.API_PORT ?? 4000);
const databasePath = process.env.API_DATABASE_PATH ?? './.data/credora.sqlite';
const maxBodyBytes = Number(process.env.API_MAX_BODY_BYTES ?? 64 * 1024);
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

const blockchain: BlockchainAdapter | undefined = registryAddress
  ? new RegistryBlockchainAdapter(
      { chain, rpcUrl, contractAddress: registryAddress },
      createCredoraPublicClient({ chain, rpcUrl, contractAddress: registryAddress }),
    )
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
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
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

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  const contentLength = Number(header(request, 'content-length') ?? 0);
  if (contentLength > maxBodyBytes)
    throw new CredoraError('Request body is too large', 'PAYLOAD_TOO_LARGE', 413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  for (const chunk of chunks) size += chunk.length;
  if (size > maxBodyBytes)
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
  if (!blockchain) throw ledgerUnavailable();
  try {
    if (!(await blockchain.isAdmin(session.address)))
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
      },
    });
    return;
  }

  if (method === 'GET' && path === '/readyz') {
    if (!blockchain) {
      send(request, response, 503, { ok: false, ready: false, reason: 'LEDGER_UNAVAILABLE' });
      return;
    }
    try {
      await blockchain.getCredential(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );
      send(request, response, 200, { ok: true, ready: true });
    } catch {
      send(request, response, 503, { ok: false, ready: false, reason: 'LEDGER_UNAVAILABLE' });
    }
    return;
  }

  if (method === 'GET' && path === '/metrics') {
    send(request, response, 200, Object.fromEntries(metrics));
    return;
  }

  if (method === 'GET' && path === '/demo/catalog') {
    send(request, response, 200, demoCatalog);
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
    if (!session.roles.includes('ISSUER') && !isOrgAdmin(session))
      throw new CredoraError('Issuer or organization-admin role required', 'FORBIDDEN', 403);
    const limitValue = Number(url.searchParams.get('limit') ?? 50);
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100)
      throw new CredoraError('limit must be 1-100', 'INVALID_QUERY', 400);
    const organization = isOrgAdmin(session)
      ? (database
          .prepare("SELECT id FROM organizations WHERE admin_address = ? AND status = 'active'")
          .get(session.address) as { id: string } | undefined)
      : undefined;
    const items = database
      .prepare(
        organization
          ? `SELECT id, issuer, learner, skill_name, skill_level, issue_date, metadata_uri,
                credential_hash, transaction_hash, block_number, state, created_at
         FROM issuances WHERE organization_id = ?
         ORDER BY created_at DESC LIMIT ?`
          : `SELECT id, issuer, learner, skill_name, skill_level, issue_date, metadata_uri,
                credential_hash, transaction_hash, block_number, state, created_at
         FROM issuances WHERE issuer = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(organization?.id ?? session.address, limitValue);
    send(request, response, 200, { items, limit: limitValue });
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
    if (!isOrgAdmin(session))
      throw new CredoraError('Organization-admin role required', 'FORBIDDEN', 403);
    const organization = database
      .prepare("SELECT id, name FROM organizations WHERE admin_address = ? AND status = 'active'")
      .get(session.address) as { id: string; name: string } | undefined;
    const counts = database
      .prepare(
        `SELECT state, COUNT(*) AS count
         FROM issuances
         WHERE ${organization ? 'organization_id = ?' : 'issuer = ?'}
         GROUP BY state`,
      )
      .all(organization?.id ?? session.address) as { state: string; count: number }[];
    let issuerAuthorization: 'authorized' | 'not-authorized' | 'unavailable' = 'unavailable';
    if (blockchain) {
      try {
        issuerAuthorization = (await blockchain.isIssuerAuthorized(session.address))
          ? 'authorized'
          : 'not-authorized';
      } catch {
        // Keep organization access available, but never imply the issuer check passed.
      }
    }
    send(request, response, 200, {
      address: session.address,
      organization: organization ? { id: organization.id, name: organization.name } : null,
      issuerAuthorization,
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
          (id, organization_name, website_url, applicant_address, status, created_at, logo_url) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .run(id, name, websiteUrl, session.address, createdAt, logoUrl);
    } catch (error) {
      if (isSqliteConstraint(error))
        throw new CredoraError(
          'A request from this wallet or an organization with this name is already pending',
          'APPLICATION_PENDING',
          409,
        );
      throw error;
    }
    audit(session.address, 'organization_application_submitted', { id, name, websiteUrl, logoUrl });
    send(request, response, 201, {
      id,
      organizationName: name,
      websiteUrl,
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
        `SELECT id, organization_name AS organizationName, website_url AS websiteUrl,
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
            randomUUID(),
            applicationId,
            application.organization_name,
            application.website_url,
            application.applicant_address,
            reviewedAt,
            reviewedAt,
            application.logo_url,
          );
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

  if (method === 'POST' && path === '/issuances') {
    const session = requireSession(request);
    const registry = requireLedger();
    let authorized: boolean;
    try {
      authorized = await registry.isIssuerAuthorized(session.address);
    } catch {
      throw ledgerUnavailable();
    }
    if (!authorized)
      throw new CredoraError('The connected wallet is not an authorized issuer', 'FORBIDDEN', 403);
    const body = await bodyOf(request);
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
        (id, issuer, learner, skill_name, skill_level, issue_date, state, created_at, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        (
          database
            .prepare("SELECT id FROM organizations WHERE admin_address = ? AND status = 'active'")
            .get(session.address) as { id: string } | undefined
        )?.id ?? null,
      );
    audit(session.address, 'issuance_draft_created', { id, learner, skillName, skillLevel });
    send(request, response, 201, {
      id,
      state,
      issuerAddress: session.address,
      learnerAddress: learner,
      skillName,
      skillLevel,
      issueDate,
    });
    return;
  }

  const issuanceMatch = path.match(/^\/issuances\/([^/]+)(?:\/(metadata|confirm))?$/);
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

    if (method === 'POST' && issuanceMatch[2] === 'metadata') {
      const body = await bodyOf(request);
      if (row.state === 'confirmed')
        throw new CredoraError('Issued credentials are immutable', 'IMMUTABLE_CREDENTIAL', 409);
      const metadata: CredentialMetadata = {
        schemaVersion: 1 as const,
        skillName: String(row.skill_name),
        skillLevel: String(row.skill_level),
        issueDate: normalizeIssueDate(String(row.issue_date)),
        issuerAddress: session.address as `0x${string}`,
        learnerAddress: String(row.learner) as `0x${string}`,
        description: typeof body.description === 'string' ? body.description : undefined,
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
      database
        .prepare(
          'UPDATE issuances SET metadata_uri = ?, credential_hash = ?, state = ? WHERE id = ?',
        )
        .run(stored.uri, credentialHash, 'metadata-uploaded', id);
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
      const registry = requireLedger();
      let receipt;
      try {
        receipt = await registry.waitForConfirmation(transactionHash);
      } catch {
        updateIssuanceState(id, 'transaction-pending');
        throw ledgerUnavailable();
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

      let transaction;
      let onchain;
      try {
        transaction = await registry.getIssuanceTransaction(transactionHash);
        onchain = await registry.getCredential(credentialHash);
      } catch {
        updateIssuanceState(id, 'transaction-pending');
        throw ledgerUnavailable();
      }
      if (onchain.state === 'not-found' || !transaction)
        throw new CredoraError(
          'The confirmed transaction did not issue this credential',
          'INTEGRITY_MISMATCH',
          409,
        );
      if (
        !sameAddress(transaction.from, session.address) ||
        !sameAddress(transaction.learner, String(row.learner)) ||
        transaction.metadataUri !== String(row.metadata_uri) ||
        !sameAddress(onchain.issuer ?? '', session.address) ||
        !sameAddress(onchain.learner ?? '', String(row.learner)) ||
        onchain.metadataUri !== String(row.metadata_uri)
      )
        throw new CredoraError(
          'The on-chain credential does not match this issuance',
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
      audit(session.address, 'chain_reconciliation_requested', {
        fromBlock: fromBlock?.toString(),
      });
      send(request, response, 200, result);
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
  reconcileChainEvents().catch(() => undefined);
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
