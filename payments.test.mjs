// Paying in the app: the server charges Square for exactly what Square worked out, and an order that is not paid never reaches the kitchen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";

async function setup(extra = {}) {
  const sq = await startSquare();
  sq.loyalty(false);
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_APPLICATION_ID: "sandbox-sq0idb-TESTAPP", SQUARE_API_BASE: sq.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000", ...extra });
  const order = (body = {}) => fetch(t.u + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: "drinks-refreshers-lemonade", qty: 2 }], name: "Sam", phone: "7185550123", idempotencyKey: crypto.randomUUID(), paymentToken: "cnon:card-nonce-ok", ...body }) }).then(async (r) => ({ status: r.status, json: await r.json() }));   // $7.00 before tax
  const orderCalls = () => sq.calls.filter((c) => c.method === "POST" && c.url === "/v2/orders").length;
  return { sq, t, order, orderCalls };
}

test("the app is told how to take payment, with public values only", async () => {
  const on = await setup(), off = await setup({ PAY_ONLINE: "off" }), none = await startSite({});
  try {
    const cfg = await (await fetch(on.t.u + "/api/config")).json();
    assert.deepEqual(cfg.payments, { applicationId: "sandbox-sq0idb-TESTAPP", locationId: "LOC", environment: "sandbox" });
    assert.ok(!JSON.stringify(cfg).includes("tok\""), "no access token in the public settings");
    assert.equal((await (await fetch(off.t.u + "/api/config")).json()).payments, undefined, "PAY_ONLINE=off");
    assert.equal((await (await fetch(none.u + "/api/config")).json()).payments, undefined, "no application ID, no online payment");
  } finally { on.t.close(); off.t.close(); none.close(); }
});

test("an order cannot be placed without paying, and nothing reaches Square without a payment", async () => {
  const { t, order, orderCalls } = await setup();
  try {
    for (const bad of [undefined, "", "short", "has spaces and !!", 5]) {
      const r = await order({ paymentToken: bad });
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.json.needsPayment, true);
    }
    assert.equal(orderCalls(), 0, "no order was made at Square");
  } finally { t.close(); }
});

test("the customer is charged exactly what Square worked out (tax included), and the order is paid", async () => {
  const { sq, t, order } = await setup();
  try {
    const key = crypto.randomUUID();
    const r = await order({ idempotencyKey: key });
    assert.equal(r.status, 200);
    assert.equal(r.json.paid, true);
    const sent = [...sq.payments.values()][0];
    assert.equal(sent.request.amount_money.amount, 762, "$7.00 + 8.875% tax = $7.62 (Square's number)");
    assert.equal(sent.request.order_id, r.json.orderId);
    assert.equal(sent.request.source_id, "cnon:card-nonce-ok");
    assert.equal(sent.request.autocomplete, true);
    assert.ok(sent.request.idempotency_key.startsWith("pay-") && sent.request.idempotency_key.length <= 45);
    assert.equal(r.json.totalCents, 762);
    assert.equal(sq.orders.get(r.json.orderId).state, "OPEN", "the paid order stays open for the kitchen");
    assert.ok(!("tip_money" in sent.request), "no tip, no tip_money");
  } finally { t.close(); }
});

test("a tip is charged with the payment as a real tip, up to the limits, and is not just a note", async () => {
  const { sq, t, order } = await setup();
  try {
    const r = await order({ tipCents: 150 });
    assert.equal(r.status, 200);
    const sent = [...sq.payments.values()][0].request;
    assert.deepEqual(sent.tip_money, { amount: 150, currency: "USD" });
    assert.equal(sent.amount_money.amount, 762, "the amount is the order; the tip is separate");
    assert.equal(r.json.totalCents, 912);
    assert.equal(r.json.tipCents, 150);
    const placed = sq.calls.filter((c) => c.url === "/v2/orders" && c.method === "POST").at(-1).json.order;
    assert.equal(placed.fulfillments[0].pickup_details.note, undefined, "no 'tip planned' note when the tip is charged");
    assert.equal((await order({ tipCents: 99999 })).status, 400, "an absurd tip is refused before anything is charged");
    assert.equal(sq.payments.size, 1);
  } finally { t.close(); }
  const off = await setup({ TIPS: "off" });
  try { await off.order({ tipCents: 200 }); assert.ok(!("tip_money" in [...off.sq.payments.values()][0].request), "TIPS=off charges no tip"); } finally { off.t.close(); }
});

test("a declined card says so in plain words, cancels the order so the kitchen never sees it, and a new try works", async () => {
  const { sq, t, order } = await setup();
  try {
    const declined = await order({ paymentToken: "cnon:card-nonce-declined" });
    assert.equal(declined.status, 402);
    assert.match(declined.json.error, /card was declined/);
    assert.equal(declined.json.newKey, true, "the app is told to use a new order key for the next try");
    assert.ok(!/GENERIC_DECLINE|stand-in/i.test(JSON.stringify(declined.json)), "never Square's own wording");
    assert.equal([...sq.orders.values()][0].state, "CANCELED", "the unpaid order was canceled");
    assert.match((await order({ paymentToken: "cnon:card-nonce-cvv" })).json.error, /security code or postal code/);
    assert.match((await order({ paymentToken: "cnon:card-nonce-funds" })).json.error, /enough funds/);
    const good = await order();
    assert.equal(good.status, 200);
    assert.equal([...sq.orders.values()].filter((o) => o.state === "OPEN").length, 1, "only the paid order is open");
    assert.equal(sq.payments.size, 1, "one payment, for the good order only");
  } finally { t.close(); }
});

test("trying again with the same order never charges twice, even with a fresh card token", async () => {
  const { sq, t, order } = await setup();
  try {
    const key = crypto.randomUUID();
    const first = await order({ idempotencyKey: key });
    const again = await order({ idempotencyKey: key });
    assert.equal(again.status, 200); assert.equal(again.json.orderId, first.json.orderId);
    assert.equal(sq.payments.size, 1);
    const fresh = await order({ idempotencyKey: key, paymentToken: "cnon:card-nonce-ok-second" });   // the browser made a new token for the retry
    assert.equal(fresh.status, 200, "Square says the key was used, the order is paid, so it is a success");
    assert.equal(sq.payments.size, 1, "still one payment");
  } finally { t.close(); }
});

test("when Square does not answer about the payment, the order is NOT canceled (the charge may have happened) and a retry is safe", async () => {
  const { sq, t, order } = await setup();
  try {
    const key = crypto.randomUUID();
    const r = await order({ idempotencyKey: key, paymentToken: "cnon:card-nonce-network" });
    assert.equal(r.status, 502);
    assert.match(r.json.error, /will not be charged twice|you will not be charged twice/);
    assert.equal([...sq.orders.values()][0].state, "OPEN", "left as it was");
    const retry = await order({ idempotencyKey: key });
    assert.equal(retry.status, 200);
    assert.equal(sq.payments.size, 1);
  } finally { t.close(); }
});

test("with online payment off, orders work as before (pay at the counter)", async () => {
  const { sq, t, order } = await setup({ PAY_ONLINE: "off" });
  try {
    const r = await order({ paymentToken: undefined });
    assert.equal(r.status, 200);
    assert.equal(r.json.paid, undefined);
    assert.equal(sq.payments.size, 0);
  } finally { t.close(); }
});

test("Apple Pay: the file Square gives you is served where Apple looks for it, once you put it in the data folder", async () => {
  const { t } = await setup();
  try {
    assert.equal((await fetch(t.u + "/.well-known/apple-developer-merchantid-domain-association")).status, 404, "nothing until the file is there");
    writeFileSync(path.join(t.dir, "apple-pay-domain-association"), "7B227073704964223A22414243227D");
    const r = await fetch(t.u + "/.well-known/apple-developer-merchantid-domain-association");
    assert.equal(r.status, 200);
    assert.equal(await r.text(), "7B227073704964223A22414243227D");
  } finally { t.close(); }
});
