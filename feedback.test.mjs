// Order feedback: stars and a comment after pickup, one per order, listed in the dashboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";

async function setup() {
  const sq = await startSquare();
  sq.loyalty(false);
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
  const order = (name = "Sam Lee") => fetch(t.u + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: "drinks-refreshers-lemonade", qty: 1 }], name, phone: "7185550123", idempotencyKey: crypto.randomUUID() }) }).then((r) => r.json());
  const rate = (id, body) => fetch(`${t.u}/api/order/${id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json() }));
  return { sq, t, order, rate };
}

test("a picked-up order can be rated; before pickup, or with a bad rating, it is refused", async () => {
  const { sq, t, order, rate } = await setup();
  try {
    const o = await order();
    const early = await rate(o.orderId, { stars: 5 });
    assert.equal(early.status, 409);
    assert.match(early.json.error, /once it has been picked up/);
    sq.set("COMPLETED");
    for (const bad of [0, 6, 4.5, "5", null, undefined]) assert.equal((await rate(o.orderId, { stars: bad })).status, 400, JSON.stringify(bad));
    assert.equal((await rate("NOSUCHORDER123", { stars: 5 })).status, 404);
    assert.equal((await rate(o.orderId, { stars: 5, comment: "  Great   latte\n today " })).status, 200);
    const staff = await t.login("staff", "staff-pass-12345");
    const f = (await staff.get("feedback")).json;
    assert.equal(f.count, 1); assert.equal(f.average, 5);
    assert.deepEqual([f.items[0].name, f.items[0].stars, f.items[0].comment, f.items[0].ref], ["Sam Lee", 5, "Great latte today", o.ref]);
  } finally { t.close(); }
});

test("rating again replaces the rating, the average is worked out, and long comments are cut", async () => {
  const { sq, t, order, rate } = await setup();
  try {
    sq.set("COMPLETED");
    const a = await order("Ann"), b = await order("Bo");
    await rate(a.orderId, { stars: 2, comment: "x".repeat(900) });
    await rate(b.orderId, { stars: 5 });
    await rate(a.orderId, { stars: 4 });   // changed their mind
    const owner = await t.login();
    const f = (await owner.get("feedback")).json;
    assert.equal(f.count, 2, "one rating per order");
    assert.equal(f.average, 4.5);
    assert.equal(f.items.find((x) => x.name === "Ann").comment, "", "the new rating replaced the old one, comment and all");
    await rate(a.orderId, { stars: 3, comment: "y".repeat(900) });
    assert.equal((await owner.get("feedback")).json.items.find((x) => x.name === "Ann").comment.length, 500);
  } finally { t.close(); }
});

test("staff can read feedback but only the owner can delete it; nobody signed out can see it", async () => {
  const { sq, t, order, rate } = await setup();
  try {
    sq.set("COMPLETED");
    const o = await order();
    await rate(o.orderId, { stars: 1, comment: "Cold" });
    assert.equal((await fetch(t.u + "/admin/api/feedback")).status, 401);
    const staff = await t.login("staff", "staff-pass-12345");
    assert.equal((await staff.del(`feedback/${o.orderId}`)).status, 403, "staff cannot delete");
    assert.equal((await staff.get("feedback")).json.count, 1);
    const owner = await t.login();
    assert.equal((await owner.del(`feedback/${o.orderId}`)).status, 200);
    assert.equal((await owner.get("feedback")).json.count, 0);
    assert.deepEqual((await owner.get("feedback")).json.average, null);
  } finally { t.close(); }
});
