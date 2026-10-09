// Maruf Cafe: hosts the phone app, takes quote/event requests, runs the staff dashboard and the AI helper (and optional Square checkout).
// No packages to install. Needs Node 22.12 or newer (it uses Node's built-in SQLite).
//
//   node server.mjs
//
// Only the public/ folder (plus uploaded photos) is ever served. Settings come from environment variables (see .env.example).
import http from "node:http";
import crypto from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { openDb, STATUSES, STATUS_LABELS } from "./lib/db.mjs";
import { createAuth } from "./lib/auth.mjs";
import { parseInquiry, FormError, display, FORMS } from "./lib/forms.mjs";
import { notifyOwner } from "./lib/notify.mjs";
import { normalizeMenu, publicMenu, checkoutIndex } from "./lib/menu.mjs";
import { normalizeContent, mergeContent } from "./lib/content.mjs";
import { detectImage, MAX_UPLOAD_BYTES, MAX_UPLOADS } from "./lib/uploads.mjs";
import { renderPage, robotsTxt, sitemapXml } from "./lib/render.mjs";
import { cleanMessages, ask, provider } from "./lib/assistant.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const SQUARE_VERSION = "2024-10-17";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm",
};

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
class SquareError extends Error {
  constructor(status, errors) { super(errors?.[0]?.detail || "Square request failed"); this.status = status; this.errors = errors || []; }
}

/* ------------------------------------------------------------------ checkout (Square) */

const CARD_PROBLEMS = new Set([
  "CARD_DECLINED", "GENERIC_DECLINE", "CVV_FAILURE", "ADDRESS_VERIFICATION_FAILURE", "INVALID_EXPIRATION",
  "INVALID_CARD", "CARD_EXPIRED", "INSUFFICIENT_FUNDS", "CARD_NOT_SUPPORTED", "PAYMENT_LIMIT_EXCEEDED", "TRANSACTION_LIMIT",
  "VERIFY_CVV_FAILURE", "VERIFY_AVS_FAILURE",
]);

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new HttpError(400, "Enter a 10-digit US phone number, or leave it blank.");
}

/** Validate the checkout body and return clean values. Throws HttpError(400). */
export function parseCheckout(body, menu) {
  const bad = (m) => { throw new HttpError(400, m); };
  if (!body || typeof body !== "object") bad("Invalid request.");
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) bad("Your cart is empty.");
  const qty = new Map();
  for (const it of body.items) {
    if (!it || typeof it.id !== "string") bad("Invalid cart item.");
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20) bad("Quantities must be between 1 and 20.");
    if (!menu.has(it.id)) bad("An item in your cart is not available for online ordering. Remove it and try again.");
    qty.set(it.id, (qty.get(it.id) || 0) + it.qty);
  }
  for (const n of qty.values()) if (n > 20) bad("Quantities must be between 1 and 20.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) bad("Enter a name for the pickup order.");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
  if (typeof body.sourceId !== "string" || body.sourceId.length < 1 || body.sourceId.length > 200) bad("Card details are missing. Enter your card and try again.");
  if (typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,36}$/.test(body.idempotencyKey)) bad("Invalid request.");
  return {
    lines: [...qty].map(([id, q]) => ({ id, qty: q, ...menu.get(id) })),
    name, note, phone: normalizePhone(body.phone), sourceId: body.sourceId, key: body.idempotencyKey,
  };
}

export function createServer(env = process.env) {
  const production = env.SQUARE_ENV === "production";
  const taxPercent = (() => { const n = Number(env.TAX_PERCENT); return Number.isFinite(n) && n > 0 && n <= 20 ? n : 0; })();
  const cfg = {
    token: env.SQUARE_ACCESS_TOKEN || "", locationId: env.SQUARE_LOCATION_ID || "", appId: env.SQUARE_APP_ID || "",
    environment: production ? "production" : "sandbox", taxPercent,
  };
  const enabled = !!(cfg.token && cfg.locationId && cfg.appId);
  const apiBase = env.SQUARE_API_BASE || (production ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com");
  const dataDir = env.DATA_DIR || path.join(ROOT, "data");
  const uploadDir = path.join(dataDir, "uploads");
  const allowOrigin = env.ALLOWED_ORIGIN || "*";   // the phone app is not served from this origin
  // Behind a host's proxy (Render sets RENDER) every visitor reaches us from the proxy's address, so rate limits and
  // sign-in lockouts need the visitor's real address, which the proxy appends to X-Forwarded-For.
  const trustProxy = env.TRUST_PROXY === "1" || (!!env.RENDER && env.TRUST_PROXY !== "0");
  const clientIp = (req) => (trustProxy && String(req.headers["x-forwarded-for"] || "").split(",").pop().trim()) || req.socket.remoteAddress;
  const publicUrl = /^https?:\/\/[^\s/]+/i.test(env.PUBLIC_URL || "") ? env.PUBLIC_URL.replace(/\/+$/, "") : "";

  // Storage. If the disk cannot be written the site still works (menu and pages come from the files) but the
  // server says so, and a request is only accepted if an email or webhook notification actually went out.
  let db = null, storageError = "";
  try { db = openDb(dataDir); mkdirSync(uploadDir, { recursive: true }); db.importJsonl(path.join(dataDir, "inquiries.jsonl")); }
  catch (err) { storageError = err.message; db = null; console.error("Could not open the database:", err.message); }

  const auth = createAuth(env);
  for (const w of auth.warnings) console.error(w);
  const defaultMenu = JSON.parse(readFileSync(path.join(PUBLIC, "menu.json"), "utf8"));
  const defaultContent = normalizeContent(JSON.parse(readFileSync(path.join(PUBLIC, "content.default.json"), "utf8"))).content;
  const getMenu = () => (db && db.kvGet("menu")?.value) || defaultMenu;
  const getContent = () => mergeContent(defaultContent, db && db.kvGet("content")?.value);
  const manages = (role) => role === "owner" || (role === "staff" && env.STAFF_CAN_EDIT_SITE === "1");

  async function square(method, route, body) {
    let res;
    try {
      res = await fetch(apiBase + route, {
        method,
        headers: { Authorization: `Bearer ${cfg.token}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      const e = new Error("Could not reach Square.");
      e.unreachable = true;
      throw e;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new SquareError(res.status, json.errors);
    return json;
  }

  async function checkout(body) {
    const { lines, name, note, phone, sourceId, key } = parseCheckout(body, checkoutIndex(getMenu()));

    const order = {
      location_id: cfg.locationId,
      line_items: lines.map((l) => ({ name: l.name, quantity: String(l.qty), base_price_money: { amount: l.cents, currency: "USD" } })),
      fulfillments: [{
        type: "PICKUP", state: "PROPOSED",
        pickup_details: { recipient: { display_name: name, ...(phone ? { phone_number: phone } : {}) }, schedule_type: "ASAP", ...(note ? { note } : {}) },
      }],
    };
    if (cfg.taxPercent > 0) order.taxes = [{ uid: "sales-tax", name: "Sales tax", percentage: String(cfg.taxPercent), scope: "ORDER" }];

    let created;
    try {
      created = (await square("POST", "/v2/orders", { idempotency_key: `${key}-o`, order })).order;
    } catch (err) {
      if (err instanceof SquareError) throw new HttpError(502, "We could not start your order. Please try again.");
      throw new HttpError(502, "We could not reach our payment provider. Please try again.");
    }

    try {
      const { payment } = await square("POST", "/v2/payments", {
        idempotency_key: `${key}-p`, source_id: sourceId, location_id: cfg.locationId, order_id: created.id,
        amount_money: created.total_money, autocomplete: true, note: `Web pickup order for ${name}`.slice(0, 500),
      });
      return { ok: true, orderId: created.id, paymentId: payment.id, status: payment.status, receiptUrl: payment.receipt_url || null, totalCents: created.total_money.amount };
    } catch (err) {
      if (err instanceof SquareError) {
        // A definite failure: nothing was charged. Cancel the unpaid order so it does not sit in the queue.
        await square("PUT", `/v2/orders/${created.id}`, { order: { location_id: cfg.locationId, state: "CANCELED", version: created.version } }).catch(() => {});
        const card = err.errors.some((e) => CARD_PROBLEMS.has(e.code));
        throw new HttpError(card ? 402 : 502, card ? "Your card was declined. Try another card." : "We could not take your payment. You were not charged.", { retry: true });
      }
      // Timeout or network failure: we do not know whether the charge went through. Leave the order alone.
      throw new HttpError(502, `We could not confirm your payment. Please do not pay again. Show order ${created.id.slice(0, 8)} to the cafe or check your receipt.`, { uncertain: true, orderId: created.id });
    }
  }

  /* ---- quote / event requests: store first, then notify. A request counts as received only once it is stored or sent. ---- */
  async function inquiry(body) {
    if (typeof body?.website === "string" && body.website.trim()) return { ok: true, id: "ok" };   // honeypot: bots fill this in
    let parsed;
    try { parsed = parseInquiry(body); }
    catch (err) { if (err instanceof FormError) throw new HttpError(400, err.message, { fields: err.fields }); throw err; }
    const rec = { id: crypto.randomUUID(), type: parsed.type, title: parsed.title, receivedAt: new Date().toISOString(), fields: parsed.clean };
    let stored = false;
    try { if (db) { db.insertInquiry(rec); stored = true; } } catch (err) { console.error("Could not store request:", err.message); }
    const sent = await notifyOwner(env, rec, parsed.labels);
    if (stored) { try { db.setNotify(rec.id, sent); } catch { /* the request itself is already saved */ } }
    if (!stored && sent !== "sent" && sent !== "partial") throw new HttpError(500, "We could not save your request. Please call us so we do not miss it.");
    return { ok: true, id: rec.id };
  }

  /* ---- the app's assistant: needs ANTHROPIC_API_KEY; capped per visitor and per day so it cannot run up a bill ---- */
  const assistantOn = !!provider(env);
  const assistantPerMin = Number(env.ASSISTANT_RATE_LIMIT_PER_MIN) || 6, assistantPerDay = Number(env.ASSISTANT_DAILY_LIMIT) || 300;
  let assistantDay = "", assistantCount = 0;
  async function assistant(body) {
    if (!assistantOn) throw new HttpError(503, "The assistant is not switched on yet. Please call us or send a request.");
    const clean = cleanMessages(body?.messages);
    if (clean.error) throw new HttpError(400, clean.error);
    const day = new Date().toISOString().slice(0, 10);
    if (day !== assistantDay) { assistantDay = day; assistantCount = 0; }
    if (assistantCount >= assistantPerDay) throw new HttpError(429, "The assistant has reached its limit for today. Please call us or send a request.");
    assistantCount++;
    try { return { ok: true, ...(await ask(env, getContent(), publicMenu(getMenu()), clean.messages)) }; }
    catch (err) { throw new HttpError(502, err.message); }
  }

  /* ---- rate limits, responses, bodies ---- */
  const rateMax = Number(env.RATE_LIMIT_PER_MIN) || 10;
  const inquiryMax = Number(env.INQUIRY_RATE_LIMIT_PER_MIN) || 5;
  const hits = new Map();
  function limited(bucket, ip, max) {
    const k = `${bucket}:${ip}`, now = Date.now(), recent = (hits.get(k) || []).filter((t) => now - t < 60000);
    recent.push(now); hits.set(k, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > max;
  }

  function send(res, status, body, { type = "application/json; charset=utf-8", cache = "no-store", cors = false, headers = {} } = {}) {
    res.writeHead(status, {
      "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
      ...(cors ? { "Access-Control-Allow-Origin": allowOrigin } : {}), ...headers,
    });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }

  async function readRaw(req, max) {
    let size = 0; const chunks = [];
    // Past the limit we stop keeping data but read on, so the sender can finish and receive the 413 answer.
    for await (const c of req) { size += c.length; if (size <= max) chunks.push(c); else if (size > max * 4) { req.destroy(); break; } }
    if (size > max) throw new HttpError(413, "That is too large.");
    return Buffer.concat(chunks);
  }
  async function readBody(req, max = 20000) {
    try { return JSON.parse((await readRaw(req, max)).toString("utf8")); } catch (err) { if (err instanceof HttpError) throw err; throw new HttpError(400, "Invalid request."); }
  }

  const baseFor = (req) => {
    if (publicUrl) return publicUrl;
    const host = String(req.headers.host || "");
    if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host) || /^(localhost|127\.|\[)/i.test(host)) return "";
    return `${req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${host}`;
  };
  const isHttps = (req) => publicUrl.startsWith("https:") || req.headers["x-forwarded-proto"] === "https";
  const PAGES = ["/app/", "/privacy", "/support"];
  // The old website is gone: its addresses send people to the matching place in the app, so old links and emails still work.
  const MOVED = { "/": "/app/", "/index.html": "/app/", "/large-orders": "/app/orders", "/rent-the-cafe": "/app/events" };

  /* ---- staff dashboard API ---- */
  /** A request as the dashboard shows it: the stored values plus readable label/value pairs. */
  const withView = (r) => ({ ...r, view: Object.entries(r.fields).map(([k, v]) => [FORMS[r.type]?.fields[k]?.[0] || k, display(k, v)]) });
  const csvCell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

  async function adminApi(req, res, url, ip) {
    const route = url.pathname.slice("/admin/api/".length), method = req.method;
    const out = (status, body, extra) => send(res, status, body, extra);
    const secure = isHttps(req);
    if (!auth.enabled) throw new HttpError(404, "The staff dashboard is switched off. Set ADMIN_PASSWORD to turn it on.");

    if (route === "login") {
      if (method !== "POST") throw new HttpError(405, "Method not allowed.");
      const origin = req.headers.origin;
      if (origin) { let ok = false; try { ok = new URL(origin).host === req.headers.host; } catch { /* bad origin */ } if (!ok) throw new HttpError(403, "Not allowed."); }
      const b = await readBody(req, 2000);
      const r = auth.login(typeof b.username === "string" ? b.username : "", typeof b.password === "string" ? b.password : "", ip);
      if (!r.ok) throw new HttpError(r.status, r.error);
      db?.audit(r.user, "login");
      return out(200, { ok: true, user: r.user, role: r.role, csrf: r.csrf, canManageSite: manages(r.role), canEditMenu: true }, { headers: { "Set-Cookie": auth.cookie(r.token, secure, r.maxAge) } });
    }
    const session = auth.session(req);
    if (!session) throw new HttpError(401, "Please sign in.");
    const who = session.user, role = session.role, canManage = manages(role);
    if (route === "me") return out(200, { ok: true, user: who, role, csrf: session.csrf, canManageSite: canManage, canEditMenu: true });
    if (method !== "GET" && method !== "HEAD" && !auth.csrfOk(req, session)) throw new HttpError(403, "Your sign-in expired. Reload the page and try again.");
    if (route === "logout") {
      if (method !== "POST") throw new HttpError(405, "Method not allowed.");
      auth.logout(session.token);
      return out(200, { ok: true }, { headers: { "Set-Cookie": auth.clearCookie(secure) } });
    }
    const ownerOnly = () => { if (role !== "owner") throw new HttpError(403, "Only the owner account can see this."); };
    const needOwner = () => { if (!canManage) throw new HttpError(403, "Your account cannot change this. Ask the owner."); };
    if (!db) throw new HttpError(503, `The database is not available (${storageError}).`);

    /* requests (owner and staff) */
    if (route === "inquiries" && method === "GET") {
      const status = url.searchParams.get("status") || "", type = url.searchParams.get("type") || "", q = (url.searchParams.get("q") || "").slice(0, 100);
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1), limit = 20;
      if (status && !STATUSES.includes(status)) throw new HttpError(400, "Unknown status.");
      if (type && type !== "large-order" && type !== "event") throw new HttpError(400, "Unknown type.");
      const { total, rows } = db.listInquiries({ status, type, q, limit, offset: (page - 1) * limit });
      return out(200, { ok: true, total, page, pages: Math.max(1, Math.ceil(total / limit)), rows: rows.map(withView), counts: db.counts(), statuses: STATUS_LABELS });
    }
    if (route === "inquiries.csv" && method === "GET") {
      const { rows } = db.listInquiries({ limit: 100000 });
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r.fields)))];
      const lines = [["Received (NY time)", "Type", "Status", "Notes", ...keys].map(csvCell).join(",")];
      for (const r of rows) lines.push([new Date(r.receivedAt).toLocaleString("en-US", { timeZone: "America/New_York" }), r.title, STATUS_LABELS[r.status], r.notes, ...keys.map((k) => (r.fields[k] ? display(k, r.fields[k]) : ""))].map(csvCell).join(","));
      db.audit(who, "export");
      return out(200, lines.join("\r\n"), { type: "text/csv; charset=utf-8", headers: { "Content-Disposition": 'attachment; filename="maruf-cafe-requests.csv"' } });
    }
    let m = /^inquiries\/([0-9a-f-]{36})$/.exec(route);
    if (m && method === "GET") { const r = db.getInquiry(m[1]); if (!r) throw new HttpError(404, "Request not found."); return out(200, { ok: true, request: withView(r) }); }
    if (m && method === "PATCH") {
      const b = await readBody(req, 10000), patch = {};
      if (b.status !== undefined) { if (!STATUSES.includes(b.status)) throw new HttpError(400, "Unknown status."); patch.status = b.status; }
      if (b.notes !== undefined) { if (typeof b.notes !== "string" || b.notes.length > 4000) throw new HttpError(400, "Notes must be text up to 4000 characters."); patch.notes = b.notes; }
      const r = db.updateInquiry(m[1], patch, who);
      if (!r) throw new HttpError(404, "Request not found.");
      db.audit(who, "request.update", `${m[1].slice(0, 8)} ${patch.status ? `status=${patch.status}` : ""}${patch.notes !== undefined ? " notes" : ""}`.trim());
      return out(200, { ok: true, request: withView(r), counts: db.counts() });
    }

    /* menu, content, photos (owner, or staff when STAFF_CAN_EDIT_SITE=1) */
    // Staff can edit the menu and prices (anyone signed in can). Site info, photos and resetting the menu stay with the owner.
    if (route === "menu" && method === "GET") { return out(200, { ok: true, menu: getMenu(), custom: !!db.kvGet("menu") }); }
    if (route === "menu" && method === "PUT") {
      const { menu, errors } = normalizeMenu((await readBody(req, 600000)).menu);
      if (errors.length) throw new HttpError(400, errors[0], { errors });
      db.kvSet("menu", menu, who); db.audit(who, "menu.save");
      return out(200, { ok: true, menu });
    }
    if (route === "menu" && method === "DELETE") { ownerOnly(); db.kvDel("menu"); db.audit(who, "menu.reset"); return out(200, { ok: true, menu: defaultMenu }); }
    if (route === "content" && method === "GET") { needOwner(); return out(200, { ok: true, content: getContent(), custom: !!db.kvGet("content"), slots: ["hero", "largeOrders", "catering", "interior", "interior2", "event"] }); }
    if (route === "content" && method === "PUT") {
      needOwner();
      const given = (await readBody(req, 300000)).content;
      if (!given || typeof given !== "object") throw new HttpError(400, "No content was sent.");
      const { content, errors } = normalizeContent(given);
      if (errors.length) throw new HttpError(400, errors[0], { errors });
      db.kvSet("content", content, who); db.audit(who, "content.save");
      return out(200, { ok: true, content: getContent() });
    }
    if (route === "uploads" && method === "GET") { needOwner(); return out(200, { ok: true, uploads: db.listUploads() }); }
    if (route === "uploads" && method === "POST") {
      needOwner();
      if (db.countUploads() >= MAX_UPLOADS) throw new HttpError(400, "You have reached the photo limit. Delete a photo you do not use first.");
      const buf = await readRaw(req, MAX_UPLOAD_BYTES);
      const kind = detectImage(buf);
      if (!kind) throw new HttpError(400, "That file is not a JPEG, PNG or WebP picture.");
      const id = crypto.randomUUID(), file = `${id}.${kind.ext}`;
      let original = ""; try { original = decodeURIComponent(String(req.headers["x-filename"] || "")).replace(/[^\w .()-]/g, "").slice(0, 80); } catch { /* ignore a bad name */ }
      writeFileSync(path.join(uploadDir, file), buf);
      db.addUpload({ id, file, mime: kind.mime, size: buf.length, original, user: who });
      db.audit(who, "upload", file);
      return out(200, { ok: true, upload: { id, file, url: `/uploads/${file}`, mime: kind.mime, size: buf.length, original } });
    }
    m = /^uploads\/([0-9a-f-]{36})$/.exec(route);
    if (m && method === "DELETE") {
      needOwner();
      const up = db.getUpload(m[1]);
      if (!up) throw new HttpError(404, "Photo not found.");
      const c = getContent(), url2 = `/uploads/${up.file}`;
      if (c.gallery.some((g) => g.url === url2) || Object.values(c.photos).includes(url2)) throw new HttpError(409, "This photo is still used on the site. Remove it from the gallery or photo spot first.");
      db.delUpload(up.id);
      try { unlinkSync(path.join(uploadDir, up.file)); } catch { /* already gone */ }
      db.audit(who, "upload.delete", up.file);
      return out(200, { ok: true });
    }

    /* health of the setup (owner only) */
    if (route === "audit" && method === "GET") { ownerOnly(); return out(200, { ok: true, entries: db.listAudit(100) }); }
    if (route === "status" && method === "GET") {
      ownerOnly();
      return out(200, {
        ok: true, assistant: assistantOn,
        email: !!(env.RESEND_API_KEY && env.NOTIFY_EMAIL), webhook: !!env.INQUIRY_WEBHOOK_URL, storage: true,
        square: enabled ? cfg.environment : "off", publicUrl: !!publicUrl, staffAccount: !!env.STAFF_PASSWORD && env.STAFF_PASSWORD.length >= 10,
        staffCanEditSite: env.STAFF_CAN_EDIT_SITE === "1", warnings: auth.warnings, counts: db.counts(),
      });
    }
    throw new HttpError(404, "Not found.");
  }

  /** Map a URL path to a file inside public/, or null. Dotfiles and anything outside public/ are never served. */
  async function resolveStatic(pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return null; }
    if (rel.includes("\0") || rel.split("/").some((seg) => seg.startsWith("."))) return null;
    let file = path.join(PUBLIC, rel);
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) return null;
    try {
      if ((await stat(file)).isDirectory()) { if (!pathname.endsWith("/")) return { redirect: pathname + "/" }; file = path.join(file, "index.html"); }
      if (!(await stat(file)).isFile()) return null;
    } catch { return null; }
    const type = TYPES[path.extname(file).toLowerCase()];
    return type ? { file, type } : null;
  }

  const ADMIN_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

  return http.createServer(async (req, res) => {
    let cors = false;
    try {
      const url = new URL(req.url, "http://localhost");
      const ip = clientIp(req);
      const p = url.pathname;
      cors = p === "/api/inquiry" || p === "/api/config" || p === "/api/assistant" || p === "/menu.json" || p === "/content.json" || p.startsWith("/uploads/");
      if (cors && req.method === "OPTIONS") {
        res.writeHead(204, { "Access-Control-Allow-Origin": allowOrigin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" });
        return res.end();
      }
      if (p === "/api/config" && req.method === "GET") {
        return send(res, 200, enabled ? { enabled, appId: cfg.appId, locationId: cfg.locationId, environment: cfg.environment, taxPercent: cfg.taxPercent } : { enabled: false }, { cors: true });
      }
      if (p === "/api/checkout") {
        if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
        if (!enabled) throw new HttpError(503, "Online checkout is not switched on yet.");
        if (limited("checkout", ip, rateMax)) throw new HttpError(429, "Too many attempts. Wait a minute and try again.");
        return send(res, 200, await checkout(await readBody(req)));
      }
      if (p === "/api/inquiry") {
        if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
        if (limited("inquiry", ip, inquiryMax)) throw new HttpError(429, "Too many requests. Please wait a minute or call us.");
        return send(res, 200, await inquiry(await readBody(req)), { cors: true });
      }
      if (p === "/api/assistant") {
        if (req.method === "GET") return send(res, 200, { enabled: assistantOn }, { cors: true });
        if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
        if (limited("assistant", ip, assistantPerMin)) throw new HttpError(429, "Too many questions. Wait a minute and try again.");
        return send(res, 200, await assistant(await readBody(req, 12000)), { cors: true });
      }
      if (p.startsWith("/admin/api/")) return await adminApi(req, res, url, ip);
      if (p === "/admin/requests") { res.writeHead(301, { Location: "/admin/" }); return res.end(); }

      if (req.method === "GET" || req.method === "HEAD") {
        const head = req.method === "HEAD";
        if (p === "/menu.json") return send(res, 200, head ? "" : publicMenu(getMenu()), { cors: true, cache: "no-cache" });
        if (p === "/content.json") {
          const { business, venue, faq, packages, packagesNote, gallery, reviews, photos } = getContent();
          return send(res, 200, head ? "" : { business, venue, faq, packages, packagesNote, gallery, reviews, photos }, { cors: true, cache: "no-cache" });
        }
        if (p === "/robots.txt") return send(res, 200, robotsTxt(baseFor(req)), { type: "text/plain; charset=utf-8", cache: "no-cache" });
        if (p === "/sitemap.xml") { const base = baseFor(req); if (!base) throw new HttpError(404, "Not found."); return send(res, 200, sitemapXml(base, PAGES), { type: "application/xml; charset=utf-8", cache: "no-cache" }); }
        if (MOVED[p]) { res.writeHead(302, { Location: MOVED[p], "Cache-Control": "no-cache" }); return res.end(); }
        let um = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(p);
        if (um) {
          const rec = db?.getUploadByFile(um[1]);
          if (!rec) throw new HttpError(404, "Not found.");
          let data;
          try { data = await readFile(path.join(uploadDir, rec.file)); } catch { throw new HttpError(404, "Not found."); }
          return send(res, 200, head ? "" : data, { type: rec.mime, cache: "public, max-age=31536000, immutable", cors: true });
        }

        let hit = await resolveStatic(p);
        // The phone app's own screens (/app/events, /app/menu ...) all load the app's single page.
        if (!hit && /^\/app\//.test(p) && !path.extname(p)) hit = await resolveStatic("/app/index.html");
        // Plain addresses for simple pages: /privacy serves privacy.html, /large-orders serves large-orders.html.
        if (!hit && !path.extname(p) && p !== "/") hit = await resolveStatic(`${p.replace(/\/$/, "")}.html`);
        if (hit?.redirect) { res.writeHead(301, { Location: hit.redirect }); return res.end(); }
        if (hit) {
          const admin = p.startsWith("/admin/");
          let body = await readFile(hit.file);
          if (hit.type.startsWith("text/html") && !admin && !p.startsWith("/app/")) {
            const name = path.basename(hit.file, ".html");
            body = renderPage(body.toString("utf8"), getContent(), { base: baseFor(req), path: name === "index" ? "/" : `/${name}` });
          }
          const cache = /^\/(vendor|fonts)\//.test(p) ? "public, max-age=604800" : "no-cache";
          const headers = admin ? { "Content-Security-Policy": ADMIN_CSP, "X-Robots-Tag": "noindex, nofollow" } : {};
          return send(res, 200, head ? "" : body, { type: hit.type, cache: admin ? "no-store" : cache, headers });
        }
      }
      throw new HttpError(404, "Not found.");
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { ok: false, error: err.message, ...err.extra }, { cors });
      console.error("Unhandled error:", err.message);   // never log request bodies or tokens
      return send(res, 500, { ok: false, error: "Something went wrong." }, { cors });
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => {
    const e = process.env, on = !!(e.SQUARE_ACCESS_TOKEN && e.SQUARE_LOCATION_ID && e.SQUARE_APP_ID);
    const notify = [e.INQUIRY_WEBHOOK_URL && "webhook", e.RESEND_API_KEY && e.NOTIFY_EMAIL && "email"].filter(Boolean);
    console.log(`Maruf Cafe on http://localhost:${port}`);
    console.log(`  Square checkout: ${on ? (e.SQUARE_ENV === "production" ? "LIVE" : "sandbox") : "off (set SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APP_ID)"}`);
    console.log(`  Requests: saved in ${path.join(e.DATA_DIR || path.join(ROOT, "data"), "maruf.db")}${notify.length ? ` + ${notify.join(" + ")} notification` : " (no notification set: see RESEND_API_KEY / INQUIRY_WEBHOOK_URL)"}`);
    console.log(`  Staff dashboard: ${e.ADMIN_PASSWORD && e.ADMIN_PASSWORD.length >= 10 ? "on at /admin/" : "off (set ADMIN_PASSWORD, at least 10 characters)"}`);
  });
}
