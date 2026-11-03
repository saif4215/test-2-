// The chat and the café's Square item list: it reads descriptions from Square (read only), never states a price Square and the app disagree on,
// goes on without Square if Square is down, and says "call us" (handoff) whenever a person should answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startSite } from "./test-helpers.mjs";
import { parseCatalog, compareMenus } from "./lib/square-catalog.mjs";

const LOC = "LOC1";
const PAGE1 = { objects: [
  { type: "CATEGORY", id: "CAT1", category_data: { name: "Coffee" } },
  { type: "ITEM", id: "I1", present_at_all_locations: true, item_data: { name: "Latte", description_plaintext: "Espresso with steamed milk, made fresh.", category_id: "CAT1", variations: [{ item_variation_data: { price_money: { amount: 450, currency: "USD" } } }] } },
  { type: "ITEM", id: "I2", present_at_all_locations: true, item_data: { name: "Americano", description: "Hot water over two shots.", variations: [{ item_variation_data: { price_money: { amount: 350, currency: "USD" } } }] } },
], cursor: "page2" };
const PAGE2 = { objects: [
  { type: "ITEM", id: "I3", present_at_all_locations: true, item_data: { name: "Mystery Special", description: "Only in Square.", variations: [] } },
  { type: "ITEM", id: "I4", present_at_all_locations: true, item_data: { name: "Old Thing", is_archived: true, variations: [] } },
  { type: "ITEM", id: "I5", present_at_all_locations: false, present_at_location_ids: ["OTHER"], item_data: { name: "Other Shop Item", variations: [] } },
  { type: "ITEM", id: "I6", is_deleted: true, item_data: { name: "Deleted Thing" } },
  { type: "ITEM", id: "I7", present_at_all_locations: true, absent_at_location_ids: [LOC], item_data: { name: "Absent Here", variations: [] } },
] };

async function squareMock({ fail = false } = {}) {
  const calls = [];
  const s = http.createServer((req, res) => {
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization });
    res.setHeader("content-type", "application/json");
    if (fail) { res.statusCode = 500; return res.end('{"errors":[]}'); }
    if (req.url.startsWith("/v2/catalog/list")) return res.end(JSON.stringify(new URL(req.url, "http://x").searchParams.get("cursor") === "page2" ? PAGE2 : PAGE1));
    res.statusCode = 404; res.end("{}");
  });
  await new Promise((r) => s.listen(0, r)); s.unref();
  return { calls, base: `http://localhost:${s.address().port}` };
}
async function aiMock(say) {
  const calls = [];
  const s = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    calls.push(JSON.parse(raw));
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ content: [{ type: "text", text: say }] }));
  });
  await new Promise((r) => s.listen(0, r)); s.unref();
  return { calls, base: `http://localhost:${s.address().port}` };
}
const withSquare = (m, extra = {}) => startSite({ SQUARE_ACCESS_TOKEN: "sq-secret", SQUARE_LOCATION_ID: LOC, SQUARE_API_BASE: m.base, ASSISTANT_RATE_LIMIT_PER_MIN: "100", ...extra });
const chat = (t, text) => fetch(t.u + "/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: text }] }) }).then((r) => r.json());

test("reading Square's item list: names, descriptions, prices; archived, deleted and other-location items left out", () => {
  const items = parseCatalog([PAGE1, PAGE2], LOC);
  assert.deepEqual(items.map((i) => i.name), ["Latte", "Americano", "Mystery Special"]);
  assert.equal(items[0].description, "Espresso with steamed milk, made fresh."); assert.equal(items[0].category, "Coffee"); assert.deepEqual(items[0].prices, [450]);
  assert.equal(items[1].description, "Hot water over two shots.");
  assert.deepEqual(parseCatalog([null, {}, { objects: "x" }], LOC), []);
});

test("comparing with the app menu: matches by name, finds price differences and items on one side only", () => {
  const menu = { groups: { Drinks: { Coffee: [{ id: "a", name: "Latte", cents: 450 }, { id: "b", name: "Americano", cents: 300 }, { id: "c", name: "Lemonade", min: 400, max: 600 }, { id: "h", name: "Hidden", cents: 1, hidden: true }] } } };
  const { byName, report } = compareMenus(parseCatalog([PAGE1, PAGE2], LOC), menu);
  assert.equal(report.matched, 2);
  assert.deepEqual(report.differ, [{ name: "Americano", app: 300, square: [350] }]);
  assert.deepEqual(report.onlyInSquare, ["Mystery Special"]); assert.deepEqual(report.onlyInApp, ["Lemonade"]);
  assert.equal(byName.get("latte").differ, false); assert.equal(byName.get("americano").differ, true);
});

test("built-in chat: uses the café's description from Square, and never states a price that Square and the app disagree on", async () => {
  const m = await squareMock(); const t = await withSquare(m);
  const latte = await chat(t, "tell me about the latte");
  assert.match(latte.reply, /Latte: \$4\.50 \(before tax\)\. Espresso with steamed milk, made fresh\./); assert.equal(latte.handoff, undefined);
  const americano = await chat(t, "how much is an americano");
  assert.doesNotMatch(americano.reply, /\$3\.00|\$3\.50/); assert.match(americano.reply, /call \(929\) 335-3296/i); assert.equal(americano.handoff, true);
  const coffee = await chat(t, "what coffee do you have");
  assert.match(coffee.reply, /Cappuccino \$4\.00/); assert.match(coffee.reply, /Americano \(please call for today's price\)/);
  const allergy = await chat(t, "does the latte have dairy");
  assert.match(allergy.reply, /Espresso with steamed milk/); assert.match(allergy.reply, /can't confirm ingredients or allergy/); assert.equal(allergy.handoff, true);
  t.close();
});

test("handoff: the chat says 'call us' whenever it cannot answer, and not when it can", async () => {
  const t = await startSite({ ASSISTANT_RATE_LIMIT_PER_MIN: "100" });
  for (const q of ["tell me a joke", "is the burger gluten free", "is it halal", "how many people can you fit", "do you need a deposit", "is there parking"]) assert.equal((await chat(t, q)).handoff, true, q);
  for (const q of ["what are your hours", "how much is a latte", "where are you", "how do I rent the cafe", "hi"]) assert.equal((await chat(t, q)).handoff, undefined, q);
  t.close();
});

test("AI chat: told what the café wrote in Square, told not to state a doubtful price, and its 'call us' reaches the app", async () => {
  const sq = await squareMock();
  const ai = await aiMock(JSON.stringify({ reply: "I'm not sure. Please call (929) 335-3296.", handoff: true, add: [] }));
  const t = await withSquare(sq, { ANTHROPIC_API_KEY: "k", ANTHROPIC_API_BASE: ai.base });
  const r = await chat(t, "is the mystery special spicy?");
  assert.equal(r.handoff, true); assert.match(r.reply, /call/i);
  const system = ai.calls[0].system;
  assert.match(system, /FROM THE CAFÉ'S SQUARE REGISTER/); assert.match(system, /Latte: Espresso with steamed milk, made fresh\./);
  assert.match(system, /PRICE NOT CONFIRMED[^\n]*Americano/);
  for (const gone of ["Old Thing", "Other Shop Item", "Deleted Thing", "Absent Here"]) assert.ok(!system.includes(gone), gone);
  assert.match(system, /set "handoff" to true/);
  assert.ok(!JSON.stringify(ai.calls).includes("sq-secret"), "the Square token never goes to the AI");
  const plain = await aiMock("We open at 7 AM.");
  const t2 = await withSquare(sq, { ANTHROPIC_API_KEY: "k", ANTHROPIC_API_BASE: plain.base });
  assert.equal((await chat(t2, "hours?")).handoff, false);
  t.close(); t2.close();
});

test("Square is read only, with the café's token, and the item list is kept for a while", async () => {
  const m = await squareMock(); const t = await withSquare(m);
  await chat(t, "latte?"); await chat(t, "americano?"); await chat(t, "tea?");
  assert.ok(m.calls.length === 2 && m.calls.every((c) => c.method === "GET" && c.auth === "Bearer sq-secret" && c.url.startsWith("/v2/catalog/list")), "two pages, read once, only GET");
  assert.doesNotMatch(JSON.stringify(await chat(t, "latte?")) + await (await fetch(t.u + "/api/config")).text() + await (await fetch(t.u + "/content.json")).text(), /sq-secret/);
  t.close();
});

test("if Square cannot be read the chat goes on without it, tries again only after a minute, and the dashboard says so", async () => {
  const m = await squareMock({ fail: true }); const t = await withSquare(m);
  const r = await chat(t, "how much is a latte");
  assert.match(r.reply, /Latte: \$4\.50/);
  await chat(t, "hi"); await chat(t, "hours");
  assert.equal(m.calls.length, 1, "it does not hammer Square");
  const a = await t.login();
  const status = (await a.get("status")).json;
  assert.equal(status.squareMenu.ok, false); assert.match(status.squareMenu.error, /Could not read/);
  t.close();
});

test("the dashboard lists what differs between Square and the app menu, and shows nothing without Square", async () => {
  const m = await squareMock(); const t = await withSquare(m);
  const s = (await (await t.login()).get("status")).json.squareMenu;
  assert.equal(s.ok, true); assert.equal(s.items, 3); assert.equal(s.matched, 2);
  assert.deepEqual(s.differ, [{ name: "Americano", app: 300, square: [350] }]);
  assert.deepEqual(s.onlyInSquare, ["Mystery Special"]);
  assert.ok(s.onlyInApp.length > 10);
  const a = await t.login(); const menu = (await a.get("menu")).json.menu;
  menu.groups.Drinks.Coffee.find((i) => i.name === "Americano").cents = 350;
  await a.put("menu", { menu });
  assert.deepEqual((await a.get("status")).json.squareMenu.differ, [], "fixing the price clears the difference at once");
  assert.match((await chat(t, "how much is an americano")).reply, /Americano: \$3\.50/);
  t.close();
  const off = await startSite({});
  assert.equal((await (await off.login()).get("status")).json.squareMenu, null);
  off.close();
});
