// Run with: node --test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createServer } from "./server.mjs";

let mock, app, base, calls, mode;
const KEY = "11111111-2222-3333-4444-555555555555";
const body = (o = {}) => ({ items: [{ id: "drinks-coffee-latte", qty: 2 }], name: "Sam", sourceId: "cnon:abc", idempotencyKey: KEY, ...o });
const post = (b) => fetch(base + "/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, json: await r.json() }));

before(async () => {
  mock = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const json = raw ? JSON.parse(raw) : {};
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, json });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v2/orders") {
      const sub = json.order.line_items.reduce((s, l) => s + l.base_price_money.amount * Number(l.quantity), 0);
      const total = json.order.taxes ? Math.round(sub * 1.08875) : sub;
      return res.end(JSON.stringify({ order: { id: "ORDER123456", version: 1, total_money: { amount: total, currency: "USD" } } }));
    }
    if (req.url === "/v2/payments") {
      if (mode === "declined") { res.statusCode = 402; return res.end(JSON.stringify({ errors: [{ code: "CARD_DECLINED", detail: "x" }] })); }
      return res.end(JSON.stringify({ payment: { id: "PAY1", status: "COMPLETED", receipt_url: "https://squareup.com/receipt/x" } }));
    }
    res.end("{}");
  });
  await new Promise((r) => mock.listen(0, r));
  const env = { SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_APP_ID: "app", SQUARE_API_BASE: `http://localhost:${mock.address().port}`, TAX_PERCENT: "8.875", RATE_LIMIT_PER_MIN: "1000" };
  app = createServer(env);
  await new Promise((r) => app.listen(0, r));
  base = `http://localhost:${app.address().port}`;
});
after(() => { app.close(); mock.close(); });
const reset = (m = "ok") => { calls = []; mode = m; };

test("config exposes only public values", async () => {
  const j = await (await fetch(base + "/api/config")).json();
  assert.deepEqual(j, { enabled: true, appId: "app", locationId: "LOC", environment: "sandbox", taxPercent: 8.875 });
});

test("charges server-side prices and pairs one order with one payment", async () => {
  reset();
  const r = await post(body({ items: [{ id: "drinks-coffee-latte", qty: 2 }], price: 1, total: 1 }));   // client-supplied price is ignored
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  const [order, pay] = calls;
  assert.equal(order.auth, "Bearer tok");
  assert.equal(order.json.order.line_items[0].base_price_money.amount, 450);
  assert.equal(order.json.order.line_items[0].quantity, "2");
  assert.equal(order.json.order.taxes[0].percentage, "8.875");
  assert.equal(pay.json.order_id, "ORDER123456");
  assert.equal(pay.json.amount_money.amount, Math.round(900 * 1.08875));
  assert.equal(pay.json.source_id, "cnon:abc");
  assert.notEqual(order.json.idempotency_key, pay.json.idempotency_key);
  assert.ok(order.json.idempotency_key.length <= 45 && pay.json.idempotency_key.length <= 45);
});

test("rejects unknown, ranged and malformed items", async () => {
  reset();
  for (const items of [[{ id: "nope", qty: 1 }], [{ id: "drinks-refreshers-lemonade", qty: 1 }], [{ id: "drinks-coffee-latte", qty: 0 }], [{ id: "drinks-coffee-latte", qty: 21 }], []]) {
    assert.equal((await post(body({ items }))).status, 400, JSON.stringify(items));
  }
  assert.equal(calls.length, 0, "nothing should reach Square");
});

test("validates name, phone and idempotency key", async () => {
  reset();
  assert.equal((await post(body({ name: " " }))).status, 400);
  assert.equal((await post(body({ phone: "123" }))).status, 400);
  assert.equal((await post(body({ idempotencyKey: "short" }))).status, 400);
  assert.equal((await post(body({ phone: "(718) 555-0123" }))).status, 200);
  assert.equal(calls[0].json.order.fulfillments[0].pickup_details.recipient.phone_number, "+17185550123");
});

test("a declined card cancels the unpaid order and says so", async () => {
  reset("declined");
  const r = await post(body());
  assert.equal(r.status, 402);
  assert.match(r.json.error, /declined/i);
  const cancel = calls.find((c) => c.method === "PUT");
  assert.equal(cancel.url, "/v2/orders/ORDER123456");
  assert.equal(cancel.json.order.state, "CANCELED");
});

test("serves only allow-listed files", async () => {
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/menu.json")).status, 200);
  for (const p of ["/server.mjs", "/server.test.mjs", "/.env", "/../package.json", "/vendor/../server.mjs", "/%2e%2e/server.mjs"]) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});

test("serves the app manifest, service worker and icons", async () => {
  const m = await fetch(base + "/manifest.webmanifest");
  assert.equal(m.status, 200);
  assert.equal((await m.json()).display, "standalone");
  assert.equal((await fetch(base + "/sw.js")).status, 200);
  assert.equal((await fetch(base + "/icon-512.png")).headers.get("content-type"), "image/png");
});

test("checkout is off without Square settings", async () => {
  const off = createServer({});
  await new Promise((r) => off.listen(0, r));
  const u = `http://localhost:${off.address().port}`;
  assert.deepEqual(await (await fetch(u + "/api/config")).json(), { enabled: false });
  assert.equal((await fetch(u + "/api/checkout", { method: "POST", body: "{}" })).status, 503);
  off.close();
});

test("rate limits repeated checkout attempts", async () => {
  const s = createServer({ SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "l", SQUARE_APP_ID: "a", RATE_LIMIT_PER_MIN: "2" });
  await new Promise((r) => s.listen(0, r));
  const u = `http://localhost:${s.address().port}/api/checkout`;
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await fetch(u, { method: "POST", body: "{}" })).status);
  assert.deepEqual(codes, [400, 400, 429]);
  s.close();
});

/* ---------------- quote and event requests ---------------- */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const goodOrder = { fullName: "Sam Lee", phone: "(929) 555-0101", email: "sam@example.com", dateNeeded: "2026-12-20", fulfillment: "pickup", people: "40", foodItems: "6 trays of chicken, 2 of rice", pickupTime: "17:30" };
const goodEvent = { name: "Ana", phone: "9295550102", email: "ana@example.com", eventType: "Birthday party", eventDate: "2026-11-14", guests: "30", needFood: "yes", venueType: "full-venue" };

async function inquiryServer(extra = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "maruf-"));
  const hooks = [];
  const hook = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    hooks.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    res.end("{}");
  });
  await new Promise((r) => hook.listen(0, r));
  const hookUrl = `http://localhost:${hook.address().port}`;
  const s = createServer({ DATA_DIR: dir, INQUIRY_RATE_LIMIT_PER_MIN: "1000", INQUIRY_WEBHOOK_URL: `${hookUrl}/hook`, RESEND_API_KEY: "rk", NOTIFY_EMAIL: "owner@example.com", RESEND_API_BASE: `${hookUrl}/email`, ADMIN_PASSWORD: "s3cret", ...extra });
  await new Promise((r) => s.listen(0, r));
  const u = `http://localhost:${s.address().port}`;
  const post = (b) => fetch(u + "/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, json: await r.json(), headers: r.headers }));
  return { u, dir, hooks, post, close: () => { s.close(); hook.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test("a large-order request is stored, sent to the webhook and emailed", async () => {
  const t = await inquiryServer();
  const r = await t.post({ type: "large-order", fields: goodOrder, website: "" });
  assert.equal(r.status, 200); assert.equal(r.json.ok, true);
  const saved = JSON.parse(readFileSync(path.join(t.dir, "inquiries.jsonl"), "utf8").trim());
  assert.equal(saved.fields.people, "40"); assert.equal(saved.fields.fulfillment, "pickup");
  const hook = t.hooks.find((h) => h.url === "/hook"), mail = t.hooks.find((h) => h.url === "/email");
  assert.match(hook.body.text, /Number of people: 40/);
  assert.equal(mail.auth, "Bearer rk"); assert.deepEqual(mail.body.to, ["owner@example.com"]); assert.equal(mail.body.reply_to, "sam@example.com");
  t.close();
});

test("an event request is accepted with only the required fields", async () => {
  const t = await inquiryServer();
  assert.equal((await t.post({ type: "event", fields: goodEvent })).status, 200);
  t.close();
});

test("missing or invalid fields are named so the form can highlight them", async () => {
  const t = await inquiryServer();
  const r = await t.post({ type: "large-order", fields: { ...goodOrder, email: "nope", people: "0", foodItems: "" } });
  assert.equal(r.status, 400);
  assert.deepEqual(r.json.fields.sort(), ["email", "foodItems", "people"]);
  assert.equal((await t.post({ type: "event", fields: { ...goodEvent, eventDate: "tomorrow" } })).json.fields[0], "eventDate");
  assert.equal((await t.post({ type: "nope", fields: {} })).status, 400);
  t.close();
});

test("spam that fills the hidden field is dropped quietly", async () => {
  const t = await inquiryServer();
  const r = await t.post({ type: "large-order", fields: goodOrder, website: "http://spam.example" });
  assert.equal(r.status, 200);
  assert.equal(t.hooks.length, 0);
  t.close();
});

test("a request is never reported as received when nothing could save or send it", async () => {
  const t = await inquiryServer({ DATA_DIR: path.join(fileURLToPath(import.meta.url), "cannot-be-a-folder"), INQUIRY_WEBHOOK_URL: "", RESEND_API_KEY: "" });
  const r = await t.post({ type: "large-order", fields: goodOrder });
  assert.equal(r.status, 500);
  assert.match(r.json.error, /call us/i);
  t.close();
});

test("requests are limited per minute and CORS lets the phone app call the endpoint", async () => {
  const t = await inquiryServer({ INQUIRY_RATE_LIMIT_PER_MIN: "2" });
  const pre = await fetch(t.u + "/api/inquiry", { method: "OPTIONS", headers: { Origin: "http://localhost:8081", "Access-Control-Request-Method": "POST" } });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get("access-control-allow-origin"), "*");
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await t.post({ type: "event", fields: goodEvent })).status);
  assert.deepEqual(codes, [200, 200, 429]);
  t.close();
});

test("the requests page needs the password and escapes what customers typed", async () => {
  const t = await inquiryServer();
  await t.post({ type: "large-order", fields: { ...goodOrder, foodItems: "<script>alert(1)</script>" } });
  assert.equal((await fetch(t.u + "/admin/requests")).status, 401);
  const auth = "Basic " + Buffer.from("owner:s3cret").toString("base64");
  const page = await (await fetch(t.u + "/admin/requests", { headers: { Authorization: auth } })).text();
  assert.match(page, /Sam Lee/); assert.doesNotMatch(page, /<script>alert/); assert.match(page, /&lt;script&gt;/);
  assert.equal((await fetch(t.u + "/admin/requests", { headers: { Authorization: "Basic " + Buffer.from("x:wrong").toString("base64") } })).status, 401);
  t.close();
  const off = createServer({});   // no ADMIN_PASSWORD: the page does not exist
  await new Promise((r) => off.listen(0, r));
  assert.equal((await fetch(`http://localhost:${off.address().port}/admin/requests`)).status, 404);
  off.close();
});

test("only files inside public/ are served, including through encoded traversal", async () => {
  for (const p of ["/..%2fserver.mjs", "/%2e%2e/server.mjs", "/..%2fpackage.json", "/vendor/%2e%2e/%2e%2e/server.mjs", "/data/inquiries.jsonl"]) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
  assert.equal((await fetch(base + "/vendor/three.LICENSE")).status, 404);   // unknown file types are not served
});

import { existsSync } from "node:fs";
const appBuilt = existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "public/app/index.html"));
test("the phone app is served at /app/ and its screens reload on any path", { skip: !appBuilt && "run npm run build first" }, async () => {
  const index = await fetch(base + "/app/");
  assert.equal(index.status, 200);
  assert.match(await index.text(), /manifest\.webmanifest/);
  for (const screen of ["/app/events", "/app/menu", "/app/quote"]) {
    const r = await fetch(base + screen);
    assert.equal(r.status, 200, screen);
    assert.match(r.headers.get("content-type"), /text\/html/);
  }
  assert.equal((await fetch(base + "/app/missing.js")).status, 404);          // real files that do not exist are still 404
  assert.equal((await fetch(base + "/app", { redirect: "manual" })).status, 301);
  assert.equal((await fetch(base + "/app/manifest.webmanifest")).headers.get("content-type"), "application/manifest+json");
});

test("simple pages have plain addresses (/privacy, /support)", async () => {
  for (const p of ["/privacy", "/support"]) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("content-type"), /text\/html/);
  }
  assert.match(await (await fetch(base + "/privacy")).text(), /Privacy Policy/);
  assert.equal((await fetch(base + "/nothing-here")).status, 404);
  assert.equal((await fetch(base + "/server")).status, 404);   // server.mjs is never reachable this way
});
