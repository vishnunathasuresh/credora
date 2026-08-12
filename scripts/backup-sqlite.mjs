import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'node:path';

const databasePath = resolve(process.env.API_DATABASE_PATH ?? './.data/credora.sqlite');
const backupDirectory = resolve(process.env.API_BACKUP_PATH ?? './.data/backups');
const retention = Number(process.env.API_BACKUP_RETENTION ?? 14);
mkdirSync(backupDirectory, { recursive: true });

const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
const destination = join(backupDirectory, `credora-${stamp}.sqlite`);
const escapedDestination = destination.replaceAll("'", "''");
const database = new DatabaseSync(databasePath);
try {
  database.exec(`VACUUM INTO '${escapedDestination}'`);
} finally {
  database.close();
}

const backups = readdirSync(backupDirectory)
  .filter((name) => /^credora-.*\.sqlite$/.test(name))
  .sort()
  .reverse();
for (const oldBackup of backups.slice(Math.max(1, retention)))
  unlinkSync(join(backupDirectory, oldBackup));
console.log(
  JSON.stringify({ ok: true, backup: destination, retained: Math.min(backups.length, retention) }),
);
