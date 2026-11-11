// `npm run square-check` tells the café, in plain words, whether its Square settings work. Tested against a small stand-in for Square.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { checkSquare, parseEnvFile } from "./scripts/square-check.mjs";

/** A stand-in for the parts of Square that the check touches. `tokenOk` false answers 401, like a wrong token. */
async function fakeSquare({ tokenOk = true, status = "ACTIVE", currency = "USD", catalog = true } = {}) {
  const seen = { orders: 0, auth: [] };
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    seen.auth.push(req.headers.authorization);
    res.setHeader("Content-Type", "application/json");
    if (!tokenOk) { res.statusCode = 401; return res.end(JSON.stringify({ errors: [{ code: "UNAUTHORIZED" }] })); }
    if (req.url === "/v2/locations") return res.end(JSON.stringify({ locations: [{ id: "LOC1", name: "Maruf Cafe", status, currency }] }));
    if (req.url.startsWith("/v2/catalog/list")) return res.end(JSON.stringify(catalog ? { objects: [{ type: "ITEM", id: "I1", present_at_all_locations: true, item_data: { name: "Latte", variations: [{ item_variation_data: { price_money: { amount: 450 } } }] } }] } : {}));
    if (req.method === "POST" && req.url === "/v2/orders") {
      seen.orders++;
      const o = JSON.parse(raw).order;
      const sub = o.line_items.reduce((s, l) => s + l.base_price_money.amount * Number(l.quantity), 0);
      return res.end(JSON.stringify({ order: { id: "ORDER12345", state: "OPEN", location_id: o.location_id, reference_id: o.reference_id, source: o.source, total_money: { amount: sub }, fulfillments: [{ type: "PICKUP", state: "PROPOSED" }] } }));
    }
    if (req.url === "/v2/orders/ORDER12345") return res.end(JSON.stringify({ order: { id: "ORDER12345", state: "OPEN", location_id: "LOC1", reference_id: "R", source: { name: "Maruf Cafe app" }, total_money: { amount: 450 }, fulfillments: [{ type: "PICKUP", state: "PROPOSED" }] } }));
    res.statusCode = 404; res.end("{}");
  });
  await new Promise((r) => server.listen(0, r));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() };
}
const all = (r) => r.lines.map((l) => `${l.text} ${l.fix || ""}`).join("\n");

test("missing settings are named, and nothing is called", async () => {
  const r = await checkSquare({});
  assert.equal(r.ok, false);
  assert.match(all(r), /SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID/);
});

test("good settings pass, and the access token is never printed", async () => {
  const sq = await fakeSquare();
  const r = await checkSquare({ SQUARE_ACCESS_TOKEN: "SECRET-TOKEN-123", SQUARE_LOCATION_ID: "LOC1", SQUARE_API_BASE: sq.url });
  sq.close();
  assert.equal(r.ok, true, all(r));
  assert.match(all(r), /Location: Maruf Cafe \(active\)/);
  assert.match(all(r), /1 item found/);
  assert.ok(!JSON.stringify(r).includes("SECRET-TOKEN-123"));
  assert.equal(sq.seen.orders, 0, "without --order nothing is ordered");
});

test("a rejected token says to match the token with sandbox or production", async () => {
  const sq = await fakeSquare({ tokenOk: false });
  const r = await checkSquare({ SQUARE_ACCESS_TOKEN: "x", SQUARE_LOCATION_ID: "LOC1", SQUARE_API_BASE: sq.url });
  sq.close();
  assert.equal(r.ok, false);
  assert.match(all(r), /did not accept the access token[\s\S]*Sandbox token goes with SQUARE_ENV=sandbox/);
});

test("a wrong location ID lists the ones the account has", async () => {
  const sq = await fakeSquare();
  const r = await checkSquare({ SQUARE_ACCESS_TOKEN: "x", SQUARE_LOCATION_ID: "WRONG", SQUARE_API_BASE: sq.url });
  sq.close();
  assert.equal(r.ok, false);
  assert.match(all(r), /Maruf Cafe = LOC1/);
});

test("an inactive location or a non-USD one is flagged", async () => {
  const sq = await fakeSquare({ status: "INACTIVE", currency: "CAD" });
  const r = await checkSquare({ SQUARE_ACCESS_TOKEN: "x", SQUARE_LOCATION_ID: "LOC1", SQUARE_API_BASE: sq.url });
  sq.close();
  assert.equal(r.ok, false);
  assert.match(all(r), /not active/);
  assert.match(all(r), /uses CAD/);
});

test("--order sends one test order through the app's own server and follows it", async () => {
  const sq = await fakeSquare();
  const r = await checkSquare({ SQUARE_ACCESS_TOKEN: "x", SQUARE_LOCATION_ID: "LOC1", SQUARE_API_BASE: sq.url }, { order: true });
  sq.close();
  assert.equal(r.ok, true, all(r));
  assert.equal(sq.seen.orders, 1);
  assert.match(all(r), /Test order sent/);
  assert.match(all(r), /can follow the order/);
});

test("--order is never allowed in production", async () => {
  const sq = await fakeSquare();
  const r = await checkSquare({ SQUARE_ENV: "production", SQUARE_ACCESS_TOKEN: "x", SQUARE_LOCATION_ID: "LOC1", SQUARE_API_BASE: sq.url }, { order: true });
  sq.close();
  assert.equal(sq.seen.orders, 0, "no order is placed");
  assert.equal(r.ok, false);
  assert.match(all(r), /this is production/);
});

test("the .env file reader handles comments and quotes", () => {
  const env = parseEnvFile('# a comment\nSQUARE_ENV=sandbox   # test mode\nSQUARE_ACCESS_TOKEN="abc def"\n\nSQUARE_LOCATION_ID=L1\r\nTAX_PERCENT=\n');
  assert.deepEqual(env, { SQUARE_ENV: "sandbox", SQUARE_ACCESS_TOKEN: "abc def", SQUARE_LOCATION_ID: "L1", TAX_PERCENT: "" });
});
