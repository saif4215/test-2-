// Run with: node --test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, orderRef, orderStatus } from "./server.mjs";
import { basicAnswer } from "./lib/answers.mjs";
import { normalizeContent } from "./lib/content.mjs";
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "maruf-"));

let mock, app, base, calls, mode, dataDir;
const KEY = "11111111-2222-3333-4444-555555555555";
const body = (o = {}) => ({ items: [{ id: "drinks-coffee-latte", qty: 2 }], name: "Sam", phone: "(718) 555-0123", idempotencyKey: KEY, ...o });
const post = (b) => fetch(base + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, json: await r.json() }));
const status = (id) => fetch(base + "/api/order/" + id).then(async (r) => ({ status: r.status, json: await r.json() }));

before(async () => {
  // A stand-in for Square: it records every call and answers the two order calls the server makes.
  mock = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const json = raw ? JSON.parse(raw) : {};
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, version: req.headers["square-version"], json });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/v2/orders") {
      if (mode === "fail") { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ code: "INVALID_VALUE", detail: "x" }] })); }
      const sub = json.order.line_items.reduce((s, l) => s + l.base_price_money.amount * Number(l.quantity), 0);
      const total = json.order.taxes ? Math.round(sub * 1.08875) : sub;
      return res.end(JSON.stringify({ order: { id: "ORDER123456", version: 1, state: "OPEN", total_money: { amount: total, currency: "USD" } } }));
    }
    const got = /^\/v2\/orders\/(\w+)$/.exec(req.url);
    if (req.method === "GET" && got) {
      if (got[1] === "FOREIGN123") return res.end(JSON.stringify({ order: { id: "FOREIGN123", location_id: "LOC", source: { name: "Square Online" }, state: "OPEN", fulfillments: [] } }));
      if (got[1] !== "ORDER123456") { res.statusCode = 404; return res.end(JSON.stringify({ errors: [{ code: "NOT_FOUND" }] })); }
      const f = mode.startsWith("fulfillment:") ? mode.slice(12) : "PROPOSED";
      return res.end(JSON.stringify({ order: { id: "ORDER123456", location_id: "LOC", reference_id: "K7QF", source: { name: "Maruf Cafe app" }, state: mode === "canceled" ? "CANCELED" : "OPEN", total_money: { amount: 900 }, fulfillments: [{ type: "PICKUP", state: f }] } }));
    }
    res.end("{}");
  });
  await new Promise((r) => mock.listen(0, r));
  const env = { SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: `http://localhost:${mock.address().port}`, TAX_PERCENT: "8.875", RATE_LIMIT_PER_MIN: "1000", ORDER_RATE_LIMIT_PER_MIN: "1000" };
  dataDir = mkdtempSync(path.join(os.tmpdir(), "maruf-"));
  app = createServer({ ...env, DATA_DIR: dataDir });
  await new Promise((r) => app.listen(0, r));
  base = `http://localhost:${app.address().port}`;
});
after(() => { app.close(); mock.close(); rmSync(dataDir, { recursive: true, force: true }); });
const reset = (m = "ok") => { calls = []; mode = m; };

test("config tells the app whether ordering is on, and exposes only public values", async () => {
  const r = await fetch(base + "/api/config");
  const text = await r.text();
  assert.deepEqual(JSON.parse(text), { enabled: true, environment: "sandbox", taxPercent: 8.875, maxOrderCents: 30000 });
  assert.ok(!text.includes("tok") && !text.includes("LOC"), "no token or location in the public settings");
});

test("an order becomes an unpaid pickup order in Square, priced by the server", async () => {
  reset();
  const r = await post(body({ items: [{ id: "drinks-coffee-latte", qty: 2 }], price: 1, total: 1 }));   // a price sent by the app is ignored
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.orderId, "ORDER123456");
  assert.equal(r.json.ref, orderRef(KEY));
  assert.match(r.json.ref, /^[A-HJKMNP-Z2-9]{4}$/);
  assert.equal(r.json.totalCents, Math.round(900 * 1.08875));
  assert.equal(calls.length, 1, "one call to Square: no payment is taken here");
  const [c] = calls;
  assert.equal(c.url, "/v2/orders");
  assert.equal(c.auth, "Bearer tok");
  assert.ok(c.version, "a Square API version is sent");
  assert.equal(c.json.idempotency_key, KEY);
  const o = c.json.order;
  assert.equal(o.location_id, "LOC");
  assert.equal(o.reference_id, orderRef(KEY));
  assert.equal(o.source.name, "Maruf Cafe app");
  assert.equal(o.line_items.length, 1);
  assert.equal(o.line_items[0].name, "Latte");
  assert.equal(o.line_items[0].base_price_money.amount, 450);
  assert.equal(o.line_items[0].quantity, "2");
  assert.equal(o.taxes[0].percentage, "8.875");
  const f = o.fulfillments[0];
  assert.equal(f.type, "PICKUP"); assert.equal(f.state, "PROPOSED");
  assert.equal(f.pickup_details.recipient.display_name, "Sam");
  assert.equal(f.pickup_details.recipient.phone_number, "+17185550123");
  assert.equal(f.pickup_details.schedule_type, "ASAP");
});

test("what the customer asked for on each item, and the order note, reach the café", async () => {
  reset();
  const r = await post(body({ items: [{ id: "drinks-coffee-latte", qty: 1, note: "Iced, 2 shots, oat milk" }, { id: "drinks-coffee-latte", qty: 1 }, { id: "food-breakfast-bagel-and-cream-cheese", qty: 1 }], note: "  I will be there at 5  " }));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const o = calls[0].json.order;
  const latte = o.line_items.find((l) => l.name === "Latte");
  assert.equal(latte.quantity, "2", "the same item twice is one line");
  assert.equal(latte.note, "Iced, 2 shots, oat milk");
  assert.equal(o.fulfillments[0].pickup_details.note, "I will be there at 5");
});

test("rejects unknown, hidden, ranged, malformed and oversized orders without calling Square", async () => {
  reset();
  for (const items of [[{ id: "nope", qty: 1 }], [{ id: "drinks-refreshers-lemonade", qty: 1 }], [{ id: "drinks-coffee-latte", qty: 0 }], [{ id: "drinks-coffee-latte", qty: 21 }], [{ id: "drinks-coffee-latte", qty: 15 }, { id: "drinks-coffee-latte", qty: 15 }], [], "latte", [null]]) {
    assert.equal((await post(body({ items }))).status, 400, JSON.stringify(items));
  }
  const big = await post(body({ items: ["drinks-coffee-biscoff-latte", "drinks-coffee-pistachio-latte", "drinks-coffee-banana-bread-latte"].map((id) => ({ id, qty: 20 })) }));
  assert.equal(big.status, 400);
  assert.match(big.json.error, /large order quote/i);
  assert.equal(calls.length, 0, "nothing should reach Square");
});

test("needs a name, a US phone number and a valid key", async () => {
  reset();
  assert.equal((await post(body({ name: " " }))).status, 400);
  assert.equal((await post(body({ name: "x".repeat(61) }))).status, 400);
  assert.equal((await post(body({ phone: "" }))).status, 400);
  assert.equal((await post(body({ phone: undefined }))).status, 400);
  assert.equal((await post(body({ phone: "123" }))).status, 400);
  assert.equal((await post(body({ idempotencyKey: "short" }))).status, 400);
  assert.equal((await post(body({ idempotencyKey: "has spaces and symbols!!" }))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await post(body({ phone: "1 (718) 555-0123" }))).status, 200);
  assert.equal(calls[0].json.order.fulfillments[0].pickup_details.recipient.phone_number, "+17185550123");
});

test("when Square refuses, the customer is told to retry or call, and nothing internal leaks", async () => {
  reset("fail");
  const r = await post(body());
  assert.equal(r.status, 502);
  assert.equal(r.json.retry, true);
  assert.match(r.json.error, /try again, or call us/i);
  assert.ok(!JSON.stringify(r.json).includes("INVALID_VALUE") && !JSON.stringify(r.json).includes("tok"));
});

test("sending the same order again uses the same key, so Square never makes two", async () => {
  reset();
  await post(body()); await post(body());
  assert.equal(calls.length, 2);
  assert.equal(calls[0].json.idempotency_key, calls[1].json.idempotency_key);
  assert.equal(calls[0].json.order.reference_id, calls[1].json.order.reference_id);
});

test("an order's progress follows what the café does in Square", async () => {
  for (const [state, expected] of [["PROPOSED", "received"], ["RESERVED", "accepted"], ["PREPARED", "ready"], ["COMPLETED", "done"], ["CANCELED", "canceled"]]) {
    reset("fulfillment:" + state);
    const r = await status("ORDER123456");
    assert.equal(r.status, 200, state);
    assert.deepEqual(r.json, { ok: true, status: expected, ref: "K7QF", totalCents: 900 }, state);
  }
  reset("canceled");
  assert.equal((await status("ORDER123456")).json.status, "canceled");
});

test("only orders the app placed can be looked up", async () => {
  reset();
  assert.equal((await status("FOREIGN123")).status, 404, "an order from another source is not shown");
  assert.equal((await status("MISSING999")).status, 404);
  assert.equal((await status("bad!id")).status, 404);
});

test("order progress and codes", () => {
  assert.equal(orderStatus({ state: "OPEN", fulfillments: [{ type: "PICKUP", state: "RESERVED" }] }), "accepted");
  assert.equal(orderStatus({ state: "OPEN", fulfillments: [] }), "received");
  assert.equal(orderStatus({ state: "COMPLETED", fulfillments: [] }), "done");
  assert.equal(orderStatus({ state: "OPEN", fulfillments: [{ type: "PICKUP", state: "FAILED" }] }), "canceled");
  assert.equal(orderStatus({ state: "CANCELED", fulfillments: [{ type: "PICKUP", state: "PROPOSED" }] }), "canceled");
  assert.equal(orderRef("same"), orderRef("same"));
  assert.notEqual(orderRef("one"), orderRef("two"));
});

test("the chat explains how to order, and pays at the counter, only when ordering is on", () => {
  const content = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "public", "content.default.json"), "utf8"));
  const menu = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "public", "menu.json"), "utf8"));
  const ask = (q, opts) => basicAnswer(normalizeContent(content).content, menu, [{ role: "user", content: q }], new Date(), opts).reply;
  assert.match(ask("how do i place an order?", { ordering: true }), /Place order for pickup/);
  assert.match(ask("how do i place an order?", { ordering: true }), /pay at the counter/i);
  assert.doesNotMatch(ask("how do i place an order?", {}), /Place order for pickup/);
  assert.match(ask("can i pay in the app?", { ordering: true }), /pay at the counter/i);
  assert.doesNotMatch(ask("can i pay in the app?", {}), /counter/i);
});

test("serves only allow-listed files", async () => {
  assert.equal((await fetch(base + "/privacy")).status, 200);
  assert.equal((await fetch(base + "/menu.json")).status, 200);
  for (const p of ["/server.mjs", "/server.test.mjs", "/.env", "/../package.json", "/vendor/../server.mjs", "/%2e%2e/server.mjs"]) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});

test("the website is gone: its addresses lead into the app, and the old service worker removes itself", async () => {
  for (const [from, to] of [["/", "/app/"], ["/index.html", "/app/"], ["/large-orders", "/app/groups"], ["/rent-the-cafe", "/app/groups?show=rent"]]) {
    const r = await fetch(base + from, { redirect: "manual" });
    assert.equal(r.status, 302, from); assert.equal(r.headers.get("location"), to, from);
  }
  for (const gone of ["/showcase.js", "/showcase.css", "/checkout.js", "/site.js", "/vendor/three.module.min.js", "/manifest.webmanifest", "/logo.svg"]) assert.equal((await fetch(base + gone)).status, 404, gone);
  const sw = await fetch(base + "/sw.js");
  assert.equal(sw.status, 200);
  assert.match(await sw.text(), /unregister/);
  assert.equal((await fetch(base + "/icon-512.png")).headers.get("content-type"), "image/png");
});

test("ordering is off without Square settings", async () => {
  const off = createServer({ DATA_DIR: tmp() });
  await new Promise((r) => off.listen(0, r));
  const u = `http://localhost:${off.address().port}`;
  assert.deepEqual(await (await fetch(u + "/api/config")).json(), { enabled: false });
  assert.equal((await fetch(u + "/api/order", { method: "POST", body: "{}" })).status, 503);
  assert.equal((await fetch(u + "/api/order/ABCDEFGH")).status, 503);
  assert.equal((await fetch(u + "/api/checkout", { method: "POST", body: "{}" })).status, 404, "the old card route is gone");
  off.close();
});

test("rate limits repeated order attempts", async () => {
  const s = createServer({ DATA_DIR: tmp(), SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "l", ORDER_RATE_LIMIT_PER_MIN: "2" });
  await new Promise((r) => s.listen(0, r));
  const u = `http://localhost:${s.address().port}/api/order`;
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await fetch(u, { method: "POST", body: "{}" })).status);
  assert.deepEqual(codes, [400, 400, 429]);
  s.close();
});

test("only files inside public/ are served, including through encoded traversal", async () => {
  for (const p of ["/..%2fserver.mjs", "/%2e%2e/server.mjs", "/..%2fpackage.json", "/vendor/%2e%2e/%2e%2e/server.mjs", "/data/maruf.db", "/uploads/..%2fmaruf.db", "/lib/db.mjs"]) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
  assert.equal((await fetch(base + "/vendor/three.LICENSE")).status, 404);   // unknown file types are not served
});

const appBuilt = existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "public/app/index.html"));
test("the phone app is served at /app/ and its screens reload on any path", { skip: !appBuilt && "run npm run build first" }, async () => {
  const index = await fetch(base + "/app/");
  assert.equal(index.status, 200);
  assert.match(await index.text(), /manifest\.webmanifest/);
  for (const screen of ["/app/groups", "/app/events", "/app/menu", "/app/quote"]) {
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
