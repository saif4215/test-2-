// Gift card balance: only the balance comes back, bad numbers are explained, and guessing card numbers is slowed right down.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";

async function setup(extra = {}) {
  const sq = await startSquare();
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, ...extra });
  const balance = (gan) => fetch(t.u + "/api/giftcard/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gan }) }).then(async (r) => ({ status: r.status, json: await r.json() }));
  return { sq, t, balance };
}

test("a real card shows its balance and nothing else; spaces and dashes in the number are fine", async () => {
  const { t, balance } = await setup();
  try {
    const r = await balance("7783 3200-0123 4567");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, state: "ACTIVE", balanceCents: 2550 });
    assert.ok(!JSON.stringify(r.json).includes("7783"), "the card number is never sent back");
    assert.equal((await (await fetch(t.u + "/api/config")).json()).giftCards, true);
  } finally { t.close(); }
});

test("a card that is switched off shows no balance; an unknown or badly typed number is explained", async () => {
  const { t, balance } = await setup();
  try {
    assert.deepEqual((await balance("7783320009999999")).json, { ok: true, state: "DEACTIVATED", balanceCents: 0 });
    const unknown = await balance("1111222233334444");
    assert.equal(unknown.status, 404);
    assert.match(unknown.json.error, /couldn't find that gift card/);
    for (const bad of ["", "123", "has spaces!!", "x".repeat(40), null]) assert.equal((await balance(bad)).status, 400, JSON.stringify(bad));
  } finally { t.close(); }
});

test("only 8 tries a minute from one place, so card numbers cannot be guessed", async () => {
  const { sq, t, balance } = await setup();
  try {
    for (let i = 0; i < 8; i++) assert.equal((await balance("1111222233334444")).status, 404);
    const r = await balance("7783320001234567");
    assert.equal(r.status, 429, "even a real card is refused once the limit is used up");
    assert.equal(sq.calls.giftcards, 8, "and Square is not asked again");
  } finally { t.close(); }
});

test("GIFT_CARDS=off hides it, and without Square it is not available", async () => {
  const off = await setup({ GIFT_CARDS: "off" });
  const none = await startSite({});
  try {
    assert.equal((await off.balance("7783320001234567")).status, 404);
    assert.equal((await (await fetch(off.t.u + "/api/config")).json()).giftCards, false);
    assert.equal((await fetch(none.u + "/api/giftcard/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gan: "7783320001234567" }) })).status, 404);
  } finally { off.t.close(); none.close(); }
});
