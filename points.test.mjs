// Points and promotions. Points are worked out from Square's own order once it is picked up; promotions are whatever the owner puts in the dashboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";

async function setup(extra = {}) {
  const sq = await startSquare();
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000", ...extra });
  const place = async (items) => (await (await fetch(t.u + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, name: "Sam", phone: "7185550123", idempotencyKey: `points-test-key-${Math.random().toString(36).slice(2, 10)}` }) })).json());
  return { sq, t, place };
}

test("a picked-up order earns a point for each dollar before tax, from what Square rang up; nothing before pickup", async () => {
  const { sq, t, place } = await setup();
  try {
    const o = await place([{ id: "food-breakfast-breakfast-wrap", qty: 1 }, { id: "drinks-refreshers-lemonade", qty: 1 }]);   // $10.00 + $3.50 = $13.50 before tax
    assert.equal(o.ok, true, JSON.stringify(o));
    const cfg = await (await fetch(t.u + "/api/config")).json();
    assert.equal(cfg.pointsPerDollar, 1);
    for (const state of ["PROPOSED", "RESERVED", "PREPARED"]) {
      sq.set(state);
      const r = await (await fetch(t.u + "/api/order/" + o.orderId)).json();
      assert.ok(!("points" in r), `no points while the order is ${state}`);
    }
    sq.set("COMPLETED");
    const done = await (await fetch(t.u + "/api/order/" + o.orderId)).json();
    assert.equal(done.status, "done");
    assert.equal(done.subtotalCents, 1350, "the tax Square added is not counted");
    assert.equal(done.points, 13, "13 whole dollars, 13 points");
  } finally { t.close(); }
});

test("the owner can change the points per dollar, and a canceled order earns nothing", async () => {
  const { sq, t, place } = await setup({ POINTS_PER_DOLLAR: "2" });
  try {
    const o = await place([{ id: "food-sandwiches-classic-cheeseburger", qty: 1 }]);   // $10.00
    sq.set("COMPLETED");
    assert.equal((await (await fetch(t.u + "/api/order/" + o.orderId)).json()).points, 20);
    sq.set("CANCELED");
    const c = await (await fetch(t.u + "/api/order/" + o.orderId)).json();
    assert.equal(c.status, "canceled");
    assert.ok(!("points" in c));
  } finally { t.close(); }
});

test("promotions: none to start with; what the owner adds is cleaned and served to the app; a bad end date is explained", async () => {
  const t = await startSite({});
  try {
    const none = await (await fetch(t.u + "/content.json")).json();
    assert.deepEqual(none.promotions, []);
    assert.equal(none.rewardsNote, "");
    const a = await t.login(), content = (await a.get("content")).json.content;
    content.promotions = [{ title: "  Free   cookie with any large drink ", text: " Ask for it at the counter. ", until: "2026-12-31" }, { title: "", text: "no title: dropped" }, { title: "Open ended", text: "", until: "" }];
    content.rewardsNote = "Ask at the counter what your points can be used for.";
    assert.equal((await a.put("content", { content })).status, 200);
    const live = await (await fetch(t.u + "/content.json")).json();
    assert.deepEqual(live.promotions, [{ title: "Free cookie with any large drink", text: "Ask for it at the counter.", until: "2026-12-31" }, { title: "Open ended", text: "", until: "" }]);
    assert.equal(live.rewardsNote, "Ask at the counter what your points can be used for.");
    content.promotions = [{ title: "Bad date", text: "x", until: "next week" }];
    const bad = await a.put("content", { content });
    assert.equal(bad.status, 400);
    assert.match(JSON.stringify(bad.json), /end date for \\"Bad date\\"/);
  } finally { t.close(); }
});
