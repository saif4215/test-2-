// Storage: one SQLite file (built into Node, no extra software). Requests, statuses, edited menu and
// content, uploaded photo records and an audit trail of who changed what all live in it.
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import path from "node:path";

export const STATUSES = ["new", "contacted", "quote_sent", "accepted", "declined", "closed"];
export const STATUS_LABELS = { new: "New", contacted: "Contacted", quote_sent: "Quote sent", accepted: "Accepted (internal)", declined: "Declined", closed: "Closed" };

export function openDb(dir) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "maruf.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, received_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', notes TEXT NOT NULL DEFAULT '', fields TEXT NOT NULL,
      notify_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT, updated_by TEXT);
    CREATE INDEX IF NOT EXISTS inquiries_by_status ON inquiries (status, received_at);
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT);
    CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, file TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL, original TEXT, created_at TEXT NOT NULL, created_by TEXT);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user TEXT NOT NULL, action TEXT NOT NULL, detail TEXT);
  `);

  const q = (sql) => db.prepare(sql);
  const stmts = {
    insertInquiry: q("INSERT INTO inquiries (id, type, title, received_at, fields) VALUES (?, ?, ?, ?, ?)"),
    getInquiry: q("SELECT * FROM inquiries WHERE id = ?"),
    setNotify: q("UPDATE inquiries SET notify_status = ? WHERE id = ?"),
    updateInquiry: q("UPDATE inquiries SET status = ?, notes = ?, updated_at = ?, updated_by = ? WHERE id = ?"),
    kvGet: q("SELECT value, updated_at, updated_by FROM kv WHERE key = ?"),
    kvSet: q("INSERT INTO kv (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by"),
    kvDel: q("DELETE FROM kv WHERE key = ?"),
    addUpload: q("INSERT INTO uploads (id, file, mime, size, original, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    listUploads: q("SELECT * FROM uploads ORDER BY created_at DESC"),
    getUpload: q("SELECT * FROM uploads WHERE id = ?"),
    getUploadByFile: q("SELECT * FROM uploads WHERE file = ?"),
    delUpload: q("DELETE FROM uploads WHERE id = ?"),
    countUploads: q("SELECT COUNT(*) AS n FROM uploads"),
    audit: q("INSERT INTO audit (at, user, action, detail) VALUES (?, ?, ?, ?)"),
    listAudit: q("SELECT at, user, action, detail FROM audit ORDER BY id DESC LIMIT ?"),
    counts: q("SELECT status, COUNT(*) AS n FROM inquiries GROUP BY status"),
    total: q("SELECT COUNT(*) AS n FROM inquiries"),
  };
  const now = () => new Date().toISOString();
  const row = (r) => (r ? { id: r.id, type: r.type, title: r.title, receivedAt: r.received_at, status: r.status, notes: r.notes, fields: JSON.parse(r.fields), notifyStatus: r.notify_status, updatedAt: r.updated_at, updatedBy: r.updated_by } : null);

  return {
    raw: db,
    close() { db.close(); },
    insertInquiry(rec) { stmts.insertInquiry.run(rec.id, rec.type, rec.title, rec.receivedAt, JSON.stringify(rec.fields)); },
    getInquiry(id) { return row(stmts.getInquiry.get(id)); },
    setNotify(id, status) { stmts.setNotify.run(status, id); },
    /** Update the status and/or the internal notes. Returns the updated request, or null if it does not exist. */
    updateInquiry(id, { status, notes }, user) {
      const cur = stmts.getInquiry.get(id);
      if (!cur) return null;
      const nextStatus = status ?? cur.status, nextNotes = notes ?? cur.notes;
      stmts.updateInquiry.run(nextStatus, nextNotes, now(), user, id);
      return row(stmts.getInquiry.get(id));
    },
    listInquiries({ status, type, q: search, limit = 25, offset = 0 } = {}) {
      const where = [], args = [];
      if (status) { where.push("status = ?"); args.push(status); }
      if (type) { where.push("type = ?"); args.push(type); }
      if (search) { where.push("(fields LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\')"); const like = `%${String(search).replace(/[\\%_]/g, "\\$&")}%`; args.push(like, like); }
      const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const total = db.prepare(`SELECT COUNT(*) AS n FROM inquiries ${w}`).get(...args).n;
      const rows = db.prepare(`SELECT * FROM inquiries ${w} ORDER BY received_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset).map(row);
      return { total, rows };
    },
    counts() {
      const out = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      for (const r of stmts.counts.all()) out[r.status] = r.n;
      out.all = stmts.total.get().n;
      return out;
    },
    kvGet(key) { const r = stmts.kvGet.get(key); return r ? { value: JSON.parse(r.value), updatedAt: r.updated_at, updatedBy: r.updated_by } : null; },
    kvSet(key, value, user) { stmts.kvSet.run(key, JSON.stringify(value), now(), user); },
    kvDel(key) { stmts.kvDel.run(key); },
    addUpload(u) { stmts.addUpload.run(u.id, u.file, u.mime, u.size, u.original ?? null, now(), u.user); },
    listUploads() { return stmts.listUploads.all().map((r) => ({ id: r.id, file: r.file, url: `/uploads/${r.file}`, mime: r.mime, size: r.size, original: r.original, createdAt: r.created_at, createdBy: r.created_by })); },
    getUpload(id) { return stmts.getUpload.get(id) || null; },
    getUploadByFile(file) { return stmts.getUploadByFile.get(file) || null; },
    delUpload(id) { stmts.delUpload.run(id); },
    countUploads() { return stmts.countUploads.get().n; },
    audit(user, action, detail = "") { stmts.audit.run(now(), user, action, String(detail).slice(0, 500)); },
    listAudit(limit = 100) { return stmts.listAudit.all(limit); },

    /** Bring requests saved by the first version (inquiries.jsonl) into the database, once. */
    importJsonl(file) {
      if (!existsSync(file)) return 0;
      let n = 0;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const r = JSON.parse(line);
          if (!r.id || !r.fields || stmts.getInquiry.get(r.id)) continue;
          stmts.insertInquiry.run(r.id, r.type, r.title || r.type, r.receivedAt || now(), JSON.stringify(r.fields));
          stmts.setNotify.run("not_recorded", r.id);
          n++;
        } catch { /* skip a damaged line */ }
      }
      renameSync(file, `${file}.imported`);
      return n;
    },
  };
}
