// Maruf Cafe: static site + Square checkout API. No dependencies, Node 18+.
//
//   SQUARE_ACCESS_TOKEN=... SQUARE_LOCATION_ID=... SQUARE_APP_ID=... node server.mjs
//
// The browser never sends prices. It sends item ids and quantities; prices come from menu.json here.
import http from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SQUARE_VERSION = "2024-10-17";

const FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/main.js": ["main.js", "text/javascript; charset=utf-8"],
  "/checkout.js": ["checkout.js", "text/javascript; charset=utf-8"],
  "/logo.svg": ["logo.svg", "image/svg+xml"],
  "/logo-dark.svg": ["logo-dark.svg", "image/svg+xml"],
  "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json"],
  "/sw.js": ["sw.js", "text/javascript; charset=utf-8"],
  "/icon-180.png": ["icon-180.png", "image/png"],
  "/icon-192.png": ["icon-192.png", "image/png"],
  "/icon-512.png": ["icon-512.png", "image/png"],
  "/icon-maskable-512.png": ["icon-maskable-512.png", "image/png"],
  "/menu.json": ["menu.json", "application/json; charset=utf-8"],
  "/vendor/three.module.min.js": ["vendor/three.module.min.js", "text/javascript; charset=utf-8"],
};

/** id -> { name, cents } for items with a single fixed price. Ranged (size-based) items are not orderable here. */
function loadMenu() {
  const menu = JSON.parse(readFileSync(path.join(ROOT, "menu.json"), "utf8"));
  const index = new Map();
  for (const cats of Object.values(menu.groups)) {
    for (const items of Object.values(cats)) {
      for (const it of items) if (Number.isInteger(it.cents)) index.set(it.id, { name: it.name, cents: it.cents });
    }
  }
  return index;
}

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

class SquareError extends Error {
  constructor(status, errors) { super(errors?.[0]?.detail || "Square request failed"); this.status = status; this.errors = errors || []; }
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

  async function square(method, route, body) {
    let res;
    try {
      res = await fetch(apiBase + route, {
        method,
        headers: { Authorization: `Bearer ${cfg.token}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
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

  const rateMax = Number(env.RATE_LIMIT_PER_MIN) || 10;
  const hits = new Map();
  function limited(ip) {
    const now = Date.now(), recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
    recent.push(now); hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > rateMax;
  }

  function send(res, status, body, type = "application/json; charset=utf-8", cache = "no-store") {
    res.writeHead(status, {
      "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
    });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }

  async function readBody(req) {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > 20000) throw new HttpError(413, "Request too large."); chunks.push(c); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "Invalid request."); }
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/config" && req.method === "GET") {
        return send(res, 200, enabled ? { enabled, appId: cfg.appId, locationId: cfg.locationId, environment: cfg.environment, taxPercent: cfg.taxPercent } : { enabled: false });
      }
      if (url.pathname === "/api/checkout") {
        if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
        if (!enabled) throw new HttpError(503, "Online checkout is not switched on yet.");
        if (limited(req.socket.remoteAddress)) throw new HttpError(429, "Too many attempts. Wait a minute and try again.");
        return send(res, 200, await checkout(await readBody(req)));
      }
      const file = FILES[url.pathname];
      if (file && (req.method === "GET" || req.method === "HEAD")) {
        const data = await readFile(path.join(ROOT, file[0]));
        return send(res, 200, req.method === "HEAD" ? "" : data, file[1], url.pathname.startsWith("/vendor/") ? "public, max-age=86400" : "no-cache");
      }
      throw new HttpError(404, "Not found.");
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { ok: false, error: err.message, ...err.extra });
      console.error("Unhandled error:", err.message);   // never log request bodies or tokens
      return send(res, 500, { ok: false, error: "Something went wrong." });
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => {
    const on = !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID && process.env.SQUARE_APP_ID);
    console.log(`Maruf Cafe on http://localhost:${port}  |  Square checkout: ${on ? (process.env.SQUARE_ENV === "production" ? "LIVE" : "sandbox") : "off (set SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APP_ID)"}`);
  });
}
