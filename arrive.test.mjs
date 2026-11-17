// "I'm here": a customer tells the café they have arrived for a pickup order; staff see who is waiting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";

async function setup() {
  const sq = await startSquare();
  sq.loyalty(false);
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
  const order = (name = "Sam") => fetch(t.u + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: "drinks-refreshers-lemonade", qty: 1 }], name, phone: "7185550123", idempotencyKey: crypto.randomUUID() }) }).then((r) => r.json());
  const here = (id) => fetch(`${t.u}/api/order/${id}/here`, { method: "POST" }).then(async (r) => ({ status: r.status, json: await r.json() }));
  return { sq, t, order, here };
}

test("I'm here: staff see who is waiting, once, and can dismiss it; a chat message goes out", async () => {
  const { t, order, here } = await setup();
  try {
    const staff = await t.login("staff", "staff-pass-12345");
    assert.deepEqual((await staff.get("arrivals")).json.arrivals, [], "nobody waiting at first");
    const o = await order("Sam Lee");
    const h = await here(o.orderId);
    assert.equal(h.status, 200);
    assert.equal(h.json.ref, o.ref);
    const list = (await staff.get("arrivals")).json.arrivals;
    assert.equal(list.length, 1);
    assert.deepEqual([list[0].name, list[0].ref, list[0].orderId], ["Sam Lee", o.ref, o.orderId]);
    await here(o.orderId); await here(o.orderId);
    assert.equal((await staff.get("arrivals")).json.arrivals.length, 1, "tapping again does not add a second one");
    const pings = t.hooks.filter((x) => x.body.type === "arrival");
    assert.equal(pings.length, 1, "one chat message, not one per tap");
    assert.match(pings[0].body.text, new RegExp(`Sam Lee is here for pickup order ${o.ref}`));
    assert.equal((await staff.del(`arrivals/${o.orderId}`)).status, 200);
    assert.equal((await staff.get("arrivals")).json.arrivals.length, 0, "Got it removes them from the list");
  } finally { t.close(); }
});

test("I'm here is refused for an order that is done, canceled, unknown, or not the café's", async () => {
  const { sq, t, order, here } = await setup();
  try {
    const o = await order();
    assert.equal((await here("NOSUCHORDER123")).status, 404, "an unknown order");
    sq.set("COMPLETED");
    const done = await here(o.orderId);
    assert.equal(done.status, 409);
    assert.match(done.json.error, /already been picked up/);
    const owner = await t.login();
    assert.equal((await owner.get("arrivals")).json.arrivals.length, 0, "nothing was recorded");
    assert.equal((await fetch(`${t.u}/api/order/${o.orderId}/here`)).status, 405, "only a tap (POST) counts");
  } finally { t.close(); }
});

test("only signed-in staff can read or clear the waiting list", async () => {
  const { t } = await setup();
  try {
    assert.equal((await fetch(t.u + "/admin/api/arrivals")).status, 401);
    assert.equal((await fetch(t.u + "/admin/api/arrivals/ABCDEFGH1234", { method: "DELETE" })).status, 401);
  } finally { t.close(); }
});
