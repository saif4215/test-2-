// Pickup times: which times are offered, and which are accepted. The app has its own copy of the rules (app/src/lib/pickup.js): a test keeps the two the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickupSlots, pickupProblem, pickupLabel, nyParts, nyDate } from "./lib/pickup.mjs";
import { pickupSlots as appSlots, pickupLabel as appLabel } from "./app/src/lib/pickup.js";

const HOURS = [{ days: [1, 2, 3, 4, 5], open: 7, close: 22 }, { days: [0, 6], open: 8, close: 20 }];
const at = (iso) => new Date(iso);   // New York is UTC-5 in winter, UTC-4 in summer

test("New York dates are worked out right, including across the clock change", () => {
  assert.equal(nyDate(2026, 1, 12, 17 * 60).toISOString(), "2026-01-12T22:00:00.000Z");   // winter: 5 PM is 22:00 UTC
  assert.equal(nyDate(2026, 7, 13, 17 * 60).toISOString(), "2026-07-13T21:00:00.000Z");   // summer: 5 PM is 21:00 UTC
  assert.equal(nyDate(2026, 3, 8, 12 * 60).toISOString(), "2026-03-08T16:00:00.000Z");   // the day the clocks go forward: noon is already summer time
  assert.deepEqual(nyParts(at("2026-01-12T22:00:00Z")), { year: 2026, month: 1, day: 12, weekday: 1, minutes: 17 * 60 });
});

test("times are offered every 15 minutes, from the prep time until closing, today only", () => {
  const now = at("2026-01-12T17:07:00Z");   // Monday 12:07 PM in New York
  const s = pickupSlots(HOURS, now, { minMinutes: 30 });
  assert.equal(s[0].label, "12:45 PM", "12:07 plus 30 minutes, rounded up to the next quarter hour");
  assert.equal(s.at(-1).label, "9:45 PM", "the last one starts before closing at 10 PM");
  assert.ok(s.every((x) => x.at > now.toISOString()));
  assert.equal(pickupSlots(HOURS, now, { minMinutes: 60 })[0].label, "1:15 PM");
});

test("before opening the first time is the opening time; after closing, or on a day with no hours, there are none", () => {
  assert.equal(pickupSlots(HOURS, at("2026-01-12T11:00:00Z"), { minMinutes: 30 })[0].label, "7:00 AM", "6 AM in New York: the café opens at 7");
  assert.deepEqual(pickupSlots(HOURS, at("2026-01-13T02:40:00Z"), { minMinutes: 30 }), [], "9:40 PM: not enough time before 10 PM");
  assert.deepEqual(pickupSlots([{ days: [1], open: 7, close: 22 }], at("2026-01-13T17:00:00Z")), [], "Tuesday has no hours");
  assert.deepEqual(pickupSlots([], new Date()), []);
});

test("a time is accepted only if it is a time the café offers", () => {
  const now = at("2026-01-12T17:07:00Z");
  const good = pickupSlots(HOURS, now, { minMinutes: 30 })[3].at;
  assert.equal(pickupProblem(good, HOURS, now, { minMinutes: 30 }), "");
  assert.match(pickupProblem("2026-01-12T17:20:00Z", HOURS, now, { minMinutes: 30 }), /too soon/);
  assert.match(pickupProblem("2026-01-13T17:00:00Z", HOURS, now, { minMinutes: 30 }), /today only/);
  assert.match(pickupProblem("2026-01-13T03:30:00Z", HOURS, now, { minMinutes: 30 }), /isn't open at that time/, "10:30 PM is after closing");
  assert.match(pickupProblem("not a time", HOURS, now), /isn't valid/);
  assert.match(pickupProblem(undefined, HOURS, now), /isn't valid/);
});

test("the app offers exactly the times the server accepts", () => {
  for (const iso of ["2026-01-12T17:07:00Z", "2026-07-13T14:50:00Z", "2026-03-08T15:00:00Z", "2026-11-01T11:20:00Z", "2026-01-12T11:00:00Z", "2026-01-18T13:10:00Z"]) {
    const now = at(iso);
    for (const minMinutes of [15, 30, 45]) {
      const mine = appSlots(HOURS, now, { minMinutes }), theirs = pickupSlots(HOURS, now, { minMinutes });
      assert.deepEqual(mine, theirs, `${iso} +${minMinutes}`);
      for (const s of theirs) assert.equal(pickupProblem(s.at, HOURS, now, { minMinutes }), "", `${s.label} is accepted`);
      if (theirs[0]) assert.equal(appLabel(theirs[0].at), pickupLabel(theirs[0].at));
    }
  }
});

test("an order with a pickup time reaches Square as scheduled; a time the café cannot take is refused; ASAP stays ASAP", async (ctx) => {
  const { startSite } = await import("./test-helpers.mjs");
  const { startSquare } = await import("./e2e/square-standin.mjs");
  const sq = await startSquare();
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, PICKUP_MIN_MINUTES: "5", ORDER_RATE_LIMIT_PER_MIN: "1000" });
  try {
    const cfg = await (await fetch(t.u + "/api/config")).json();
    assert.deepEqual(cfg.pickup, { minMinutes: 5, step: 15 });
    const a = await t.login(), content = (await a.get("content")).json.content;
    content.business.hours = [{ label: "Every day", days: [0, 1, 2, 3, 4, 5, 6], open: 0, close: 24 }];
    assert.equal((await a.put("content", { content })).status, 200);
    const slots = pickupSlots(content.business.hours, new Date(), { minMinutes: 5 });
    if (slots.length < 3) return ctx.skip("too close to midnight in New York to pick a time today");
    let n = 0;
    const order = (extra) => fetch(t.u + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: "drinks-refreshers-lemonade", qty: 1 }], name: "Sam", phone: "7185550123", idempotencyKey: `pickup-test-key-${String(++n).padStart(8, "0")}`, ...extra }) }).then(async (r) => ({ status: r.status, json: await r.json() }));
    const ok = await order({ pickupAt: slots[2].at });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const pd = sq.calls.at(-1).json.order.fulfillments[0].pickup_details;
    assert.equal(pd.schedule_type, "SCHEDULED");
    assert.equal(pd.pickup_at, slots[2].at);
    const asap = await order({});
    assert.equal(asap.status, 200);
    assert.equal(sq.calls.at(-1).json.order.fulfillments[0].pickup_details.schedule_type, "ASAP");
    assert.ok(!("pickup_at" in sq.calls.at(-1).json.order.fulfillments[0].pickup_details));
    const before = sq.calls.length;
    for (const [pickupAt, say] of [[new Date(Date.now() + 60000).toISOString(), /too soon/], [new Date(Date.now() + 86400000 * 2).toISOString(), /today only/], ["tomorrow", /isn't valid/], [12345, /isn't valid/]]) {
      const bad = await order({ pickupAt });
      assert.equal(bad.status, 400, String(pickupAt));
      assert.match(bad.json.error, say);
    }
    assert.equal(sq.calls.length, before, "nothing reaches Square for a time that is refused");
  } finally { t.close(); }
});
