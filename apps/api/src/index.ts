import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
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
import { CredoraError, isRecord, type OperationState, type Role } from '@credora/shared';
import { FileStorage, IpfsStorage, type MetadataStorage } from '@credora/storage';
import { defineChain, isAddress, type Address, type Hex } from 'viem';

const port = Number(process.env.API_PORT ?? 4000);
const databasePath = process.env.API_DATABASE_PATH ?? './.data/credora.sqlite';
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    message TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    roles TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS issuances (
    id TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    learner TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    skill_level TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    metadata_uri TEXT,
    credential_hash TEXT,
    transaction_hash TEXT,
    block_number INTEGER,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    details TEXT NOT NULL
  );
`);

try {
  database.exec('ALTER TABLE issuances ADD COLUMN block_number INTEGER');
} catch (error) {
  if (!String(error).toLowerCase().includes('duplicate column')) throw error;
}

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
      })
    : new FileStorage(process.env.API_STORAGE_PATH ?? './.data/metadata');
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

function stringifyJson(value: unknown) {
  return JSON.stringify(value, (_key, nested) =>
    typeof nested === 'bigint' ? nested.toString() : nested,
  );
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { ...jsonHeaders, 'access-control-allow-origin': '*' });
  response.end(stringifyJson(body));
}

function fail(response: ServerResponse, error: unknown) {
  const normalized =
    error instanceof CredoraError
      ? error
      : new CredoraError(
          error instanceof Error ? error.message : 'Unexpected API error',
          'INTERNAL_ERROR',
        );
  send(response, normalized.status, { error: normalized.code, message: normalized.message });
}

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
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
  return {
    token: row.token,
    address: normalizeAddress(row.address, 'session.address'),
    roles: JSON.parse(row.roles) as Role[],
  };
}

function requireSession(request: IncomingMessage) {
  const session = currentSession(request);
  if (!session) throw new CredoraError('A valid wallet session is required', 'UNAUTHORIZED', 401);
  return session;
}

function requiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim())
    throw new CredoraError(`${key} is required`, 'INVALID_BODY', 400);
  return value.trim();
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

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const method = request.method ?? 'GET';
  const path = url.pathname;

  if (method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
    });
    response.end();
    return;
  }

  if (method === 'GET' && path === '/health') {
    send(response, 200, {
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

  if (method === 'POST' && path === '/auth/challenge') {
    const body = await bodyOf(request);
    const address = normalizeAddress(requiredString(body, 'address'), 'address');
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
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
    send(response, 200, challenge);
    return;
  }

  if (method === 'POST' && path === '/auth/verify') {
    const body = await bodyOf(request);
    const address = normalizeAddress(requiredString(body, 'address'), 'address');
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
    const valid = await verifyAuthSignature(
      {
        address,
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: challenge.expires_at,
      },
      signature,
    );
    if (!valid) throw new CredoraError('Wallet signature was not valid', 'INVALID_SIGNATURE', 401);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const token = randomUUID();
    const roles: Role[] = ['LEARNER', 'VERIFIER'];
    if (blockchain) {
      try {
        if (await blockchain.isIssuerAuthorized(address)) roles.unshift('ISSUER');
      } catch {
        // Authentication remains available while the ledger is restarting.
      }
    }
    database
      .prepare('INSERT INTO sessions (token, address, roles, expires_at) VALUES (?, ?, ?, ?)')
      .run(token, address, JSON.stringify(roles), expiresAt);
    database.prepare('DELETE FROM challenges WHERE address = ?').run(address);
    audit(address, 'wallet_authenticated', { roles });
    send(response, 200, { token, address, roles, expiresAt });
    return;
  }

  if (method === 'POST' && path === '/auth/logout') {
    const session = requireSession(request);
    database.prepare('DELETE FROM sessions WHERE token = ?').run(session.token);
    send(response, 200, { ok: true });
    return;
  }

  if (method === 'GET' && path === '/me') {
    const session = requireSession(request);
    send(response, 200, session);
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
    const learner = normalizeAddress(requiredString(body, 'learnerAddress'), 'learnerAddress');
    const skillName = requiredString(body, 'skillName');
    const skillLevel = requiredString(body, 'skillLevel');
    const issueDate = requiredIssueDate(body);
    const id = randomUUID();
    const state: OperationState = 'draft';
    database
      .prepare(
        `
      INSERT INTO issuances
        (id, issuer, learner, skill_name, skill_level, issue_date, state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
      );
    audit(session.address, 'issuance_draft_created', { id, learner, skillName, skillLevel });
    send(response, 201, {
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
      send(response, 200, row);
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
      send(response, 200, { id, state: 'metadata-uploaded', credentialHash, ...stored });
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
        send(response, 409, {
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
      send(response, 200, {
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
      send(response, 200, {
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
      send(response, 503, {
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
      send(response, 422, {
        ...record,
        state: 'metadata-invalid',
        message: 'Credential proof found, but the metadata does not match the ledger record.',
      });
      return;
    }
    send(response, 200, {
      ...record,
      state: 'valid',
      metadata,
      message: 'Credential verified against the immutable ledger.',
    });
    return;
  }

  if (method === 'GET' && path === '/admin/audit') {
    const session = requireSession(request);
    if (!session.roles.includes('ADMIN'))
      throw new CredoraError('Admin role required', 'FORBIDDEN', 403);
    send(response, 200, database.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC').all());
    return;
  }

  throw new CredoraError('Route not found', 'NOT_FOUND', 404);
}

const server = createServer((request, response) => {
  route(request, response).catch((error) => fail(response, error));
});

server.listen(port, () => {
  console.log(`Credora API listening on http://localhost:${port}`);
});

process.on('SIGINT', () => server.close(() => database.close()));
process.on('SIGTERM', () => server.close(() => database.close()));
