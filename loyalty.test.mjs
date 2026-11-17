// Points kept in Square Loyalty: tied to the phone number, counted once when the order is picked up, never in the way of an order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";
import { tiersOf, program, accumulate } from "./lib/square-loyalty.mjs";

async function setup() {
  const sq = await startSquare();
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000", RATE_LIMIT_PER_MIN: "1000" });
  const post = (route, body) => fetch(t.u + route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json() }));
  const order = (extra = {}) => post("/api/order", { items: [{ id: "food-breakfast-breakfast-wrap", qty: 1 }, { id: "drinks-refreshers-lemonade", qty: 1 }], name: "Sam", phone: "(718) 555-0123", idempotencyKey: crypto.randomUUID(), ...extra });   // $13.50 before tax
  const lookup = (phone = "7185550123") => post("/api/loyalty/lookup", { phone });
  return { sq, t, post, order, lookup };
}

test("when the Square account has no Loyalty, nothing about points appears and orders work as before", async () => {
  const { sq, t, order, lookup } = await setup();
  try {
    sq.loyalty(false);
    assert.equal((await (await fetch(t.u + "/api/config")).json()).loyalty, undefined);
    assert.equal((await lookup()).status, 404);
    const o = await order({ loyalty: true });
    assert.equal(o.status, 200, "ticking earn points changes nothing when there is no program");
    assert.equal(sq.accounts.size, 0);
  } finally { t.close(); }
});

test("with Loyalty on: the config lists the café's rewards, a new number is not a member yet, and an order makes the account", async () => {
  const { sq, t, order, lookup } = await setup();
  try {
    const cfg = await (await fetch(t.u + "/api/config")).json();
    assert.deepEqual(cfg.loyalty.tiers.map((x) => [x.name, x.points]), [["A free cookie", 10], ["A free drink", 100]]);
    const before = await lookup();
    assert.deepEqual([before.json.member, before.json.balance], [false, 0]);
    assert.equal((await lookup("12345")).status, 400, "a bad phone number is refused");

    const plain = await order();   // did not tick "earn points": no account, nothing remembered
    assert.equal(plain.status, 200);
    assert.equal(sq.accounts.size, 0);

    const o = await order({ loyalty: true });
    assert.equal(o.status, 200);
    assert.equal(sq.accounts.size, 1);
    assert.equal([...sq.accounts.values()][0].mapping.phone_number, "+17185550123", "tied to the phone number, in Square's format");
    const after = await lookup();
    assert.deepEqual([after.json.member, after.json.balance], [true, 0], "a member with no points until the order is picked up");
  } finally { t.close(); }
});

test("points are counted once, by Square's own order total before tax, when the order is picked up, with no help from the app", async () => {
  const { sq, t, order, lookup } = await setup();
  try {
    const o = await order({ loyalty: true });
    for (const state of ["PROPOSED", "RESERVED", "PREPARED"]) { sq.set(state); await t.sweep(); assert.equal((await lookup()).json.balance, 0, `nothing while ${state}`); }
    sq.set("COMPLETED");
    await t.sweep();
    assert.equal((await lookup()).json.balance, 13, "13 whole dollars before tax; the tax does not earn points");
    await t.sweep(); await t.sweep();
    assert.equal((await lookup()).json.balance, 13, "never counted twice");
    // a second order from the same number adds to the same account
    const o2 = await order({ loyalty: true });
    assert.equal(sq.accounts.size, 1);
    await t.sweep();
    assert.equal((await lookup()).json.balance, 26);
    assert.ok(o.json.orderId !== o2.json.orderId);
  } finally { t.close(); }
});

test("a failure in Loyalty never blocks an order, and an order that is not paid yet is tried again", async () => {
  const { sq, t, order, lookup } = await setup();
  try {
    await fetch(t.u + "/api/config");   // the program is now known
    sq.loyalty(false);                  // ...and then Square's Loyalty stops answering
    const o = await order({ loyalty: true });
    assert.equal(o.status, 200, "the order still goes into Square");
    sq.loyalty(true);
    const o2 = await order({ loyalty: true });
    sq.set("PROPOSED");
    await t.sweep();
    assert.equal((await lookup()).json.balance, 0);
    sq.set("COMPLETED"); await t.sweep();
    assert.equal((await lookup()).json.balance, 13, "counted at the next check once it is picked up");
    assert.ok(o2.json.ok);
  } finally { t.close(); }
});

test("library pieces: tiers are cleaned and sorted, a missing program is null, an already-counted order counts as done", async () => {
  assert.deepEqual(tiersOf({ reward_tiers: [{ id: "b", name: "Big", points: 200 }, { id: "a", points: 50.9 }, { id: "x", points: 0 }, { name: "no id", points: 5 }] }), [{ id: "a", name: "50 points", points: 50 }, { id: "b", name: "Big", points: 200 }]);
  const err = (status, code, detail = "") => Object.assign(new Error("x"), { status, errors: [{ code, detail }] });
  assert.equal(await program(async () => { throw err(404, "NOT_FOUND"); }), null);
  assert.equal(await program(async () => { throw err(403, "FORBIDDEN"); }), null);
  assert.equal(await program(async () => ({ program: { id: "P", status: "INACTIVE" } })), null);
  await assert.rejects(program(async () => { throw err(500, "INTERNAL_SERVER_ERROR"); }), "other failures are not hidden");
  assert.deepEqual(await accumulate(async () => { throw err(400, "BAD_REQUEST", "Points were already accumulated for this order"); }, "A", "O", "L"), { done: true, points: 0 });
  assert.equal((await accumulate(async () => { throw err(400, "BAD_REQUEST", "not paid"); }, "A", "O", "L")).done, false);
});
