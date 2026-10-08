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
