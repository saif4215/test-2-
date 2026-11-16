// A copy of the café's data (requests, menu edits, photos) kept in <data folder>/backups/<date>/, one per day, the newest 7.
// It is a safety net against a mistake or a bad update. It lives on the same disk as the data, so it does not protect against losing the disk:
// copy the backups folder somewhere else now and then (or use the host's own disk snapshots).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Copy maruf.db (a clean snapshot, safe while the server is running) and the uploads folder into backups/<day>. Returns { day, dir } or null when there is no data yet. */
export function backupData(dataDir, { day = new Date().toISOString().slice(0, 10), keep = 7 } = {}) {
  const file = path.join(dataDir, "maruf.db");
  if (!existsSync(file)) return null;
  const dir = path.join(dataDir, "backups", day);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(file);
  try { db.exec(`VACUUM INTO '${path.join(dir, "maruf.db").replace(/'/g, "''")}'`); } finally { db.close(); }
  if (existsSync(path.join(dataDir, "uploads"))) cpSync(path.join(dataDir, "uploads"), path.join(dir, "uploads"), { recursive: true });
  const days = readdirSync(path.join(dataDir, "backups")).filter((n) => DAY.test(n)).sort();
  for (const old of days.slice(0, Math.max(0, days.length - keep))) rmSync(path.join(dataDir, "backups", old), { recursive: true, force: true });
  return { day, dir };
}

/** Back up now, then once a day while the server runs. Never stops the server if a backup fails. */
export function scheduleBackups(dataDir, log = console.log) {
  const run = () => { try { const r = backupData(dataDir); if (r) log(`  Backup saved: ${r.dir}`); } catch (e) { log(`  Backup failed: ${e.message}`); } };
  setTimeout(run, 5000).unref();
  setInterval(run, 24 * 3600 * 1000).unref();
}
