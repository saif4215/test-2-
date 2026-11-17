// A planned tip at checkout: a note for the cashier, never part of the order's total.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";

async function setup(extra = {}) {
  const sq = await startSquare();
  sq.loyalty(false);
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000", ...extra });
  const order = (body = {}) => fetch(t.u + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: "drinks-refreshers-lemonade", qty: 2 }], name: "Sam", phone: "7185550123", idempotencyKey: crypto.randomUUID(), ...body }) }).then(async (r) => ({ status: r.status, json: await r.json() }));   // $7.00
  const lastOrder = () => [...sq.calls].reverse().find((c) => c.method === "POST" && c.url === "/v2/orders")?.json.order;
  return { sq, t, order, lastOrder };
}

test("the config says tips are offered, and TIPS=off hides them", async () => {
  const a = await setup();
  const b = await setup({ TIPS: "off" });
  try {
    assert.equal((await (await fetch(a.t.u + "/api/config")).json()).tips, true);
    assert.equal((await (await fetch(b.t.u + "/api/config")).json()).tips, false);
  } finally { a.t.close(); b.t.close(); }
});

test("a tip becomes a note on the pickup order for the cashier, next to the customer's own note, and changes no price", async () => {
  const { t, order, lastOrder } = await setup();
  try {
    const plain = await order();
    assert.equal(plain.status, 200);
    assert.equal(lastOrder().fulfillments[0].pickup_details.note, undefined, "no tip: no note");
    const tipped = await order({ tipCents: 150, note: "No ice please" });
    assert.equal(tipped.status, 200);
    const o = lastOrder();
    assert.equal(o.fulfillments[0].pickup_details.note, "No ice please | Tip planned: $1.50. Add it when the customer pays.");
    assert.equal(o.line_items[0].base_price_money.amount, 350, "the item price is untouched");
    assert.equal(o.line_items.length, 1, "and there is no extra line for the tip");
    assert.ok(!o.service_charges, "a tip is not recorded as a service charge (that would count it as sales)");
    assert.equal(tipped.json.totalCents, plain.json.totalCents, "the order's total does not include the tip");
  } finally { t.close(); }
});

test("a tip that is not a sensible amount is refused, and TIPS=off ignores one", async () => {
  const { t, order, lastOrder } = await setup();
  const off = await setup({ TIPS: "off" });
  try {
    for (const bad of [-1, 1.5, "5", 20001, 99999, true]) assert.equal((await order({ tipCents: bad })).status, 400, `tip ${JSON.stringify(bad)}`);
    assert.equal((await order({ tipCents: 700 })).status, 200, "up to the whole order is fine");
    assert.equal((await order({ tipCents: 701 })).status, 400, "more than the order is not");
    assert.equal((await order({ tipCents: 0 })).status, 200);
    const o = await off.order({ tipCents: 200 });
    assert.equal(o.status, 200);
    assert.equal([...off.sq.calls].reverse().find((c) => c.url === "/v2/orders").json.order.fulfillments[0].pickup_details.note, undefined, "no note when tips are switched off");
    assert.ok(lastOrder());
  } finally { t.close(); off.t.close(); }
});
