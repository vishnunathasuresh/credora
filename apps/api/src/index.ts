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
import { credentialReferenceFromHash, normalizeAddress } from '@credora/credential-core';
import { CredoraError, isRecord, type OperationState, type Role } from '@credora/shared';
import { LocalStorage } from '@credora/storage';

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

const storage = new LocalStorage();
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { ...jsonHeaders, 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
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
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
  return { token: row.token, address: row.address, roles: JSON.parse(row.roles) as Role[] };
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

function audit(actor: string, action: string, details: Record<string, unknown>) {
  database
    .prepare(
      'INSERT INTO audit_logs (id, actor, action, timestamp, details) VALUES (?, ?, ?, ?, ?)',
    )
    .run(randomUUID(), actor, action, new Date().toISOString(), JSON.stringify(details));
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
    send(response, 200, { ok: true, service: 'credora-api', time: new Date().toISOString() });
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
    const body = await bodyOf(request);
    const learner = normalizeAddress(requiredString(body, 'learnerAddress'), 'learnerAddress');
    const skillName = requiredString(body, 'skillName');
    const skillLevel = requiredString(body, 'skillLevel');
    const issueDate = requiredString(body, 'issueDate');
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
      const credentialHash = requiredString(body, 'credentialHash') as `0x${string}`;
      const metadata = {
        schemaVersion: 1 as const,
        credentialHash,
        skillName: String(row.skill_name),
        skillLevel: String(row.skill_level),
        issueDate: String(row.issue_date),
        issuerAddress: session.address as `0x${string}`,
        learnerAddress: String(row.learner) as `0x${string}`,
        description: typeof body.description === 'string' ? body.description : undefined,
      };
      const stored = await storage.put(metadata);
      database
        .prepare(
          'UPDATE issuances SET metadata_uri = ?, credential_hash = ?, state = ? WHERE id = ?',
        )
        .run(stored.uri, credentialHash, 'metadata-uploaded', id);
      audit(session.address, 'issuance_metadata_uploaded', { id, uri: stored.uri });
      send(response, 200, { id, state: 'metadata-uploaded', ...stored });
      return;
    }

    if (method === 'POST' && issuanceMatch[2] === 'confirm') {
      const body = await bodyOf(request);
      const transactionHash = requiredString(body, 'transactionHash');
      const credentialHash = requiredString(body, 'credentialHash');
      const blockNumber = typeof body.blockNumber === 'number' ? body.blockNumber : null;
      database
        .prepare(
          'UPDATE issuances SET transaction_hash = ?, credential_hash = ?, state = ? WHERE id = ?',
        )
        .run(transactionHash, credentialHash, 'confirmed', id);
      audit(session.address, 'credential_issuance_confirmed', { id, transactionHash, blockNumber });
      send(response, 200, { id, state: 'confirmed', transactionHash, credentialHash, blockNumber });
      return;
    }
  }

  const verifyMatch = path.match(/^\/credentials\/([^/]+)\/verify$/);
  if (method === 'GET' && verifyMatch) {
    const reference = credentialReferenceFromHash(decodeURIComponent(verifyMatch[1]));
    send(response, 503, {
      state: 'ledger-unavailable',
      credentialHash: reference,
      message: 'Connect a deployed registry and RPC URL to enable live verification.',
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
