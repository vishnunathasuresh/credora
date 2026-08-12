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
