import type { DatabaseSync } from 'node:sqlite';

type Migration = { version: number; name: string; sql: string };

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
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
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT ''
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
    `,
  },
  {
    version: 2,
    name: 'issuance_confirmations',
    sql: 'ALTER TABLE issuances ADD COLUMN block_number INTEGER',
  },
  {
    version: 3,
    name: 'session_created_at',
    sql: 'ALTER TABLE sessions ADD COLUMN created_at TEXT NOT NULL DEFAULT ""',
  },
  {
    version: 4,
    name: 'chain_event_projection',
    sql: `
      CREATE TABLE IF NOT EXISTS chain_events (
        credential_hash TEXT NOT NULL UNIQUE,
        issuer TEXT NOT NULL,
        learner TEXT NOT NULL,
        metadata_uri TEXT NOT NULL,
        issued_at INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        block_hash TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (transaction_hash, log_index)
      );
      CREATE TABLE IF NOT EXISTS chain_sync (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        next_block INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 5,
    name: 'issuance_projection_source',
    sql: "ALTER TABLE issuances ADD COLUMN projection_source TEXT NOT NULL DEFAULT 'api'",
  },
  {
    version: 6,
    name: 'organization_intake_and_scoped_issuances',
    sql: `
      CREATE TABLE organization_applications (
        id TEXT PRIMARY KEY,
        organization_name TEXT NOT NULL,
        website_url TEXT NOT NULL,
        applicant_address TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        reviewed_by TEXT
      );
      CREATE UNIQUE INDEX organization_applications_one_pending_per_wallet
        ON organization_applications(applicant_address) WHERE status = 'pending';
      CREATE UNIQUE INDEX organization_applications_one_pending_name
        ON organization_applications(lower(organization_name)) WHERE status = 'pending';
      CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL UNIQUE REFERENCES organization_applications(id),
        name TEXT NOT NULL,
        website_url TEXT NOT NULL,
        admin_address TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX organizations_unique_name ON organizations(lower(name));
      ALTER TABLE issuances ADD COLUMN organization_id TEXT REFERENCES organizations(id);
      CREATE INDEX issuances_by_organization ON issuances(organization_id, created_at DESC);
    `,
  },
  {
    version: 7,
    name: 'expiring_selected_wallet_shares',
    sql: `
      ALTER TABLE organization_applications ADD COLUMN logo_url TEXT;
      ALTER TABLE organizations ADD COLUMN logo_url TEXT;
      CREATE TABLE wallet_shares (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        management_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE TABLE wallet_share_credentials (
        share_id TEXT NOT NULL REFERENCES wallet_shares(id) ON DELETE CASCADE,
        credential_hash TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (share_id, credential_hash),
        UNIQUE (share_id, position)
      );
      CREATE INDEX wallet_shares_active_expiry ON wallet_shares(expires_at) WHERE revoked_at IS NULL;
    `,
  },
  {
    version: 8,
    name: 'organization-verification-evidence-and-issuer-projection',
    sql: `
      ALTER TABLE organization_applications ADD COLUMN legal_name TEXT;
      ALTER TABLE organization_applications ADD COLUMN evidence_url TEXT;
      ALTER TABLE organization_applications ADD COLUMN registration_reference TEXT;
      CREATE TABLE organization_issuer_keys (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        updated_at TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        PRIMARY KEY (organization_id, wallet_address)
      );
      CREATE TABLE organization_memberships (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'issuer', 'auditor')),
        status TEXT NOT NULL CHECK (status IN ('active', 'removed')),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (organization_id, wallet_address)
      );
      CREATE TABLE credential_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        skill_level TEXT NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        created_at TEXT NOT NULL,
        UNIQUE (organization_id, name, version)
      );
    `,
  },
  {
    version: 9,
    name: 'organization-credential-chain-projection',
    sql: `
      CREATE TABLE organization_chain_events (
        credential_hash TEXT NOT NULL UNIQUE,
        organization_id TEXT,
        issuer TEXT NOT NULL,
        learner TEXT NOT NULL,
        metadata_uri TEXT NOT NULL,
        issued_at INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        block_hash TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (transaction_hash, log_index)
      );
      CREATE TABLE organization_chain_sync (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        next_block INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 10,
    name: 'organization-issuance-batches',
    sql: `
      CREATE TABLE issuance_batches (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        issuer TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        state TEXT NOT NULL,
        transaction_hash TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (organization_id, issuer, idempotency_key)
      );
      ALTER TABLE issuances ADD COLUMN batch_id TEXT REFERENCES issuance_batches(id);
      CREATE INDEX issuances_by_batch ON issuances(batch_id, created_at);
    `,
  },
  {
    version: 11,
    name: 'issuance-batch-item-order',
    sql: 'ALTER TABLE issuances ADD COLUMN batch_position INTEGER',
  },
  {
    version: 12,
    name: 'organization-optional-issuance-review',
    sql: `
      ALTER TABLE organizations ADD COLUMN approval_required INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE issuances ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';
      ALTER TABLE issuance_batches ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';
      CREATE TABLE organization_reviewers (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (organization_id, wallet_address)
      );
    `,
  },
  {
    version: 13,
    name: 'freeze-approved-issuance-payloads',
    sql: `ALTER TABLE issuances ADD COLUMN reviewed_credential_hash TEXT;
      CREATE INDEX issuances_awaiting_review ON issuances(organization_id, review_status, created_at);`,
  },
  {
    version: 14,
    name: 'private-profiles',
    sql: `
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY, wallet_address TEXT NOT NULL UNIQUE COLLATE NOCASE,
        handle TEXT NOT NULL UNIQUE COLLATE NOCASE, handle_changed_at TEXT NOT NULL,
        name TEXT NOT NULL, headline TEXT NOT NULL, bio TEXT NOT NULL,
        links_json TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1))
      );
      CREATE TABLE profile_credentials (
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        credential_hash TEXT NOT NULL, position INTEGER NOT NULL,
        PRIMARY KEY (profile_id, credential_hash), UNIQUE (profile_id, position)
      );
    `,
  },
];

function isDuplicateColumn(error: unknown) {
  return String(error).toLowerCase().includes('duplicate column');
}

export function migrateDatabase(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (const migration of migrations) {
    const applied = database
      .prepare('SELECT version FROM schema_migrations WHERE version = ?')
      .get(migration.version);
    if (applied) continue;

    try {
      database.exec('BEGIN');
      database.exec(migration.sql);
      database
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      try {
        database.exec('ROLLBACK');
      } catch {
        // Preserve the original migration error.
      }
      if (isDuplicateColumn(error)) {
        database
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
        continue;
      }
      throw error;
    }
  }

  database.prepare("UPDATE sessions SET created_at = expires_at WHERE created_at = ''").run();
}

export const currentSchemaVersion = migrations.at(-1)?.version ?? 0;
