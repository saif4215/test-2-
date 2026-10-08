// Maruf Cafe: static site + Square checkout + quote/event request API. No dependencies, Node 18+.
//
//   node server.mjs
//
// Only the public/ folder is ever served. Settings come from environment variables (see .env.example).
import http from "node:http";
import crypto from "node:crypto";
import { readFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const SQUARE_VERSION = "2024-10-17";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm",
};

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
class SquareError extends Error {
  constructor(status, errors) { super(errors?.[0]?.detail || "Square request failed"); this.status = status; this.errors = errors || []; }
}

/* ------------------------------------------------------------------ checkout (Square) */

/** id -> { name, cents } for items with a single fixed price. Ranged (size-based) items are not orderable here. */
function loadMenu() {
  const menu = JSON.parse(readFileSync(path.join(PUBLIC, "menu.json"), "utf8"));
  const index = new Map();
  for (const cats of Object.values(menu.groups)) {
    for (const items of Object.values(cats)) {
      for (const it of items) if (Number.isInteger(it.cents)) index.set(it.id, { name: it.name, cents: it.cents });
    }
  }
  return index;
}

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

/* ------------------------------------------------------------------ quote and event requests */

const short = (max = 200) => (v) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const long = short(2000);
const oneOf = (...allowed) => (v) => (allowed.includes(v) ? v : "");
const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : "");
const clock = (v) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");
const count = (max) => (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= max ? String(n) : ""; };

/** field -> [label, cleaner, required]. Order here is the order shown in emails and the admin page. */
const FORMS = {
  "large-order": {
    title: "Large order quote request",
    fields: {
      fullName: ["Full name", short(100), true], phone: ["Phone", short(40), true], email: ["Email", short(120), true],
      dateNeeded: ["Date needed", isoDate, true], fulfillment: ["Pickup or delivery", oneOf("pickup", "delivery"), true],
      people: ["Number of people", count(5000), true], pickupTime: ["Preferred pickup time", clock, false],
      foodItems: ["Food items", long, true], specialRequests: ["Special requests", long, false],
      budget: ["Budget", short(100), false], notes: ["Additional notes", long, false], occasion: ["Occasion", short(100), false],
    },
  },
  event: {
    title: "Event rental request",
    fields: {
      name: ["Name", short(100), true], phone: ["Phone", short(40), true], email: ["Email", short(120), true],
      eventType: ["Type of event", short(100), true], eventDate: ["Event date", isoDate, true],
      startTime: ["Start time", clock, false], endTime: ["End time", clock, false], guests: ["Number of guests", count(1000), true],
      needFood: ["Will you need food?", oneOf("yes", "no", "unsure"), false], catering: ["Catering required?", oneOf("yes", "no", "unsure"), false],
      foodBudget: ["Estimated food budget", short(100), false],
      venueType: ["Venue", oneOf("private-event", "full-venue", "partial-area", "other"), false],
      specialRequests: ["Special requests", long, false], decorations: ["Decorations", long, false],
      entertainment: ["Entertainment", long, false], notes: ["Other notes", long, false], packageInterest: ["Option asked about", short(100), false],
    },
  },
};

/** Returns the cleaned request, or throws HttpError(400, message, { fields: [names] }). */
export function parseInquiry(body) {
  if (!body || typeof body !== "object") throw new HttpError(400, "Invalid request.");
  const form = FORMS[body.type];
  if (!form) throw new HttpError(400, "Invalid request.");
  const clean = {}, missing = [];
  for (const [key, [, fn, required]] of Object.entries(form.fields)) {
    const v = fn(body.fields?.[key]);
    if (v) clean[key] = v; else if (required) missing.push(key);
  }
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) { delete clean.email; missing.push("email"); }
  if (clean.phone && clean.phone.replace(/\D/g, "").length < 7) { delete clean.phone; missing.push("phone"); }
  if (missing.length) throw new HttpError(400, "Please check the highlighted fields.", { fields: [...new Set(missing)] });
  return { type: body.type, title: form.title, clean, labels: Object.fromEntries(Object.entries(form.fields).map(([k, [l]]) => [k, l])) };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const summarize = (rec) => `${rec.title}\n` + Object.entries(rec.fields).map(([k, v]) => `${rec.labels[k] || k}: ${v}`).join("\n");

export function createServer(env = process.env) {
  const menu = loadMenu();
  const production = env.SQUARE_ENV === "production";
  const taxPercent = (() => { const n = Number(env.TAX_PERCENT); return Number.isFinite(n) && n > 0 && n <= 20 ? n : 0; })();
  const cfg = {
    token: env.SQUARE_ACCESS_TOKEN || "", locationId: env.SQUARE_LOCATION_ID || "", appId: env.SQUARE_APP_ID || "",
    environment: production ? "production" : "sandbox", taxPercent,
  };
  const enabled = !!(cfg.token && cfg.locationId && cfg.appId);
  const apiBase = env.SQUARE_API_BASE || (production ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com");
  const dataDir = env.DATA_DIR || path.join(ROOT, "data");
  const inquiryFile = path.join(dataDir, "inquiries.jsonl");
  const allowOrigin = env.ALLOWED_ORIGIN || "*";   // the phone app is not served from this origin

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
    const { lines, name, note, phone, sourceId, key } = parseCheckout(body, menu);

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
  async function notify(rec) {
    const text = summarize(rec);
    const jobs = [];
    if (env.INQUIRY_WEBHOOK_URL) {
      jobs.push(fetch(env.INQUIRY_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ text, content: text, id: rec.id, type: rec.type, receivedAt: rec.receivedAt, fields: rec.fields }),
      }).then((r) => { if (!r.ok) throw new Error(`webhook ${r.status}`); }));
    }
    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
      jobs.push(fetch(env.RESEND_API_BASE || "https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.NOTIFY_FROM || "Maruf Cafe <onboarding@resend.dev>", to: env.NOTIFY_EMAIL.split(",").map((s) => s.trim()), subject: `New request: ${rec.title}`, text, ...(rec.fields.email ? { reply_to: rec.fields.email } : {}) }),
      }).then((r) => { if (!r.ok) throw new Error(`email ${r.status}`); }));
    }
    const results = await Promise.allSettled(jobs);
    for (const r of results) if (r.status === "rejected") console.error("Notification failed:", r.reason?.message);
    return { attempted: jobs.length, sent: results.filter((r) => r.status === "fulfilled").length };
  }

  async function inquiry(body) {
    if (typeof body?.website === "string" && body.website.trim()) return { ok: true, id: "ok" };   // honeypot: bots fill this in
    const parsed = parseInquiry(body);
    const rec = { id: crypto.randomUUID(), type: parsed.type, title: parsed.title, receivedAt: new Date().toISOString(), fields: parsed.clean, labels: parsed.labels };
    let stored = false;
    try {
      mkdirSync(dataDir, { recursive: true });
      appendFileSync(inquiryFile, JSON.stringify(rec) + "\n");
      stored = true;
    } catch (err) { console.error("Could not store request:", err.message); }
    const sent = await notify(rec);
    if (!stored && !sent.sent) throw new HttpError(500, "We could not save your request. Please call us so we do not miss it.");
    return { ok: true, id: rec.id };
  }

  function adminPage(req, res) {
    const pass = env.ADMIN_PASSWORD;
    if (!pass) throw new HttpError(404, "Not found.");
    const given = Buffer.from((req.headers.authorization || "").replace(/^Basic /, ""), "base64").toString().split(":").slice(1).join(":");
    const h = (s) => crypto.createHash("sha256").update(s).digest();
    if (!crypto.timingSafeEqual(h(given), h(pass))) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Maruf Cafe requests"', "Cache-Control": "no-store" });
      return res.end("Sign in to see requests.");
    }
    const rows = existsSync(inquiryFile) ? readFileSync(inquiryFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).reverse() : [];
    const body = rows.map((r) => `<article><h2>${esc(r.title)} <small>${esc(new Date(r.receivedAt).toLocaleString("en-US", { timeZone: "America/New_York" }))}</small></h2><dl>${Object.entries(r.fields).map(([k, v]) => `<dt>${esc(r.labels[k] || k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></article>`).join("") || "<p>No requests yet.</p>";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Requests</title><style>body{font:16px/1.5 system-ui;max-width:760px;margin:2rem auto;padding:0 1rem}article{border:1px solid #ddd;border-radius:12px;padding:1rem 1.25rem;margin:1rem 0}h2{margin:0 0 .5rem;font-size:1.1rem}small{color:#666;font-weight:400;margin-left:.5rem}dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem 1rem;margin:0}dt{color:#666}dd{margin:0;white-space:pre-wrap}</style><h1>Requests (${rows.length})</h1>${body}`);
  }

  const rateMax = Number(env.RATE_LIMIT_PER_MIN) || 10;
  const inquiryMax = Number(env.INQUIRY_RATE_LIMIT_PER_MIN) || 5;
  const hits = new Map();
  function limited(bucket, ip, max) {
    const k = `${bucket}:${ip}`, now = Date.now(), recent = (hits.get(k) || []).filter((t) => now - t < 60000);
    recent.push(now); hits.set(k, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > max;
  }

  function send(res, status, body, type = "application/json; charset=utf-8", cache = "no-store", cors = false) {
    res.writeHead(status, {
      "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
      ...(cors ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }

  async function readBody(req) {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > 20000) throw new HttpError(413, "Request too large."); chunks.push(c); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "Invalid request."); }
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

  return http.createServer(async (req, res) => {
    let cors = false;
    try {
      const url = new URL(req.url, "http://localhost");
      const ip = req.socket.remoteAddress;
      cors = url.pathname === "/api/inquiry" || url.pathname === "/api/config";
      if (cors && req.method === "OPTIONS") {
        res.writeHead(204, { "Access-Control-Allow-Origin": allowOrigin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" });
        return res.end();
      }
      if (url.pathname === "/api/config" && req.method === "GET") {
        return send(res, 200, enabled ? { enabled, appId: cfg.appId, locationId: cfg.locationId, environment: cfg.environment, taxPercent: cfg.taxPercent } : { enabled: false }, undefined, undefined, true);
      }
      if (url.pathname === "/api/checkout") {
        if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
        if (!enabled) throw new HttpError(503, "Online checkout is not switched on yet.");
        if (limited("checkout", ip, rateMax)) throw new HttpError(429, "Too many attempts. Wait a minute and try again.");
        return send(res, 200, await checkout(await readBody(req)));
      }
      if (url.pathname === "/api/inquiry") {
        if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
        if (limited("inquiry", ip, inquiryMax)) throw new HttpError(429, "Too many requests. Please wait a minute or call us.");
        return send(res, 200, await inquiry(await readBody(req)), undefined, undefined, true);
      }
      if (url.pathname === "/admin/requests" && req.method === "GET") return adminPage(req, res);

      if (req.method === "GET" || req.method === "HEAD") {
        let hit = await resolveStatic(url.pathname);
        // The phone app's own screens (/app/events, /app/menu ...) all load the app's single page.
        if (!hit && /^\/app\//.test(url.pathname) && !path.extname(url.pathname)) hit = await resolveStatic("/app/index.html");
        // Plain addresses for simple pages: /privacy serves privacy.html, /support serves support.html.
        if (!hit && !path.extname(url.pathname) && url.pathname !== "/") hit = await resolveStatic(`${url.pathname.replace(/\/$/, "")}.html`);
        if (hit?.redirect) { res.writeHead(301, { Location: hit.redirect }); return res.end(); }
        if (hit) {
          const cache = /^\/(vendor|fonts)\//.test(url.pathname) ? "public, max-age=604800" : "no-cache";
          return send(res, 200, req.method === "HEAD" ? "" : await readFile(hit.file), hit.type, cache);
        }
      }
      throw new HttpError(404, "Not found.");
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { ok: false, error: err.message, ...err.extra }, undefined, undefined, cors);
      console.error("Unhandled error:", err.message);   // never log request bodies or tokens
      return send(res, 500, { ok: false, error: "Something went wrong." }, undefined, undefined, cors);
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => {
    const on = !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID && process.env.SQUARE_APP_ID);
    const notify = [process.env.INQUIRY_WEBHOOK_URL && "webhook", process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL && "email"].filter(Boolean);
    console.log(`Maruf Cafe on http://localhost:${port}`);
    console.log(`  Square checkout: ${on ? (process.env.SQUARE_ENV === "production" ? "LIVE" : "sandbox") : "off (set SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APP_ID)"}`);
    console.log(`  Quote/event requests: saved to data/inquiries.jsonl${notify.length ? ` + ${notify.join(" + ")} notification` : " (no notification set: see INQUIRY_WEBHOOK_URL / RESEND_API_KEY)"}`);
  });
}
