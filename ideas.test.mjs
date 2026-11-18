// Pause pickup orders, sold-out extras, and daily backups.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { startSite } from "./test-helpers.mjs";
import { startSquare } from "./e2e/square-standin.mjs";

async function startOrderSite() { const sq = await startSquare(); return startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: sq.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" }); }
import { backupData } from "./lib/backup.mjs";
import { normalizeOptionGroups, priceChoice, ChoiceError } from "./lib/options.mjs";

const order = (site, body) => fetch(site.u + "/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Sam", phone: "7185550123", idempotencyKey: crypto.randomUUID(), ...body }) }).then(async (r) => ({ status: r.status, json: await r.json() }));
const latte = (extra = {}) => ({ items: [{ id: "drinks-coffee-latte", qty: 1, picks: { temp: ["Hot"] }, ...extra }] });

test("pausing pickup orders: staff can do it, customers are told when to come back, and it ends by itself or on request", async () => {
  const site = await startOrderSite();
  try {
    const staff = await site.login("staff", "staff-pass-12345");
    assert.equal((await staff.get("pause")).json.until, null);
    assert.equal((await staff.call("POST", "pause", { minutes: 7.5 })).status, 400, "only whole minutes");
    assert.equal((await staff.call("POST", "pause", { minutes: 9999 })).status, 400);
    assert.equal((await order(site, latte())).status, 200, "open before the pause");

    const p = await staff.call("POST", "pause", { minutes: 30 });
    assert.equal(p.status, 200);
    const mins = (new Date(p.json.until) - Date.now()) / 60000;
    assert.ok(mins > 29 && mins <= 30, "paused for 30 minutes");
    assert.match(p.json.label, /\d:\d\d [AP]M/);
    const cfg = await (await fetch(site.u + "/api/config")).json();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.pausedUntil, p.json.until, "the app is told, so it can show a note");
    const blocked = await order(site, latte());
    assert.equal(blocked.status, 503);
    assert.match(blocked.json.error, /pausing pickup orders.*after \d+:\d\d [AP]M.*call us at \(929\) 335-3296/);

    assert.equal((await staff.call("POST", "pause", { minutes: 0 })).json.until, null, "open again with one tap");
    assert.equal((await fetch(site.u + "/api/config").then((r) => r.json())).pausedUntil, undefined);
    assert.equal((await order(site, latte())).status, 200);
    const audit = (await (await site.login()).get("audit")).json.entries.map((e) => e.action);
    assert.ok(audit.includes("orders.pause") && audit.includes("orders.resume"), "who paused it is recorded");
  } finally { site.close(); }
});

test("a pause that has run out stops applying on its own", async () => {
  const site = await startOrderSite();
  try {
    const owner = await site.login();
    await owner.call("POST", "pause", { minutes: 15 });
    // pretend it ended a minute ago
    const db = new DatabaseSync(path.join(site.dir, "maruf.db"));
    db.prepare("UPDATE kv SET value = ? WHERE key = 'pause'").run(JSON.stringify({ until: new Date(Date.now() - 60000).toISOString() }));
    db.close();
    assert.equal((await order(site, latte())).status, 200);
    assert.equal((await owner.get("pause")).json.until, null);
  } finally { site.close(); }
});

test("a sold-out extra cannot be ordered, and the menu still lists it so it can be shown as sold out", async () => {
  const { groups } = normalizeOptionGroups({ milk: { label: "Milk", choices: [{ name: "Oat milk", cents: 100, out: true }, { name: "Almond milk", cents: 100, out: false }] } });
  assert.deepEqual(groups.milk.choices, [{ name: "Oat milk", cents: 100, out: true }, { name: "Almond milk", cents: 100 }]);
  const entry = { name: "Latte", cents: 450, groups: [{ id: "milk", ...groups.milk, kind: "one" }] };
  assert.throws(() => priceChoice(entry, { picks: { milk: ["Oat milk"] } }), (e) => e instanceof ChoiceError && /Oat milk is sold out today/.test(e.message));
  assert.equal(priceChoice(entry, { picks: { milk: ["Almond milk"] } }).cents, 550);

  const site = await startOrderSite();
  try {
    const owner = await site.login();
    const menu = (await owner.get("menu")).json.menu;
    menu.optionGroups.milk.choices.find((c) => c.name === "Oat milk").out = true;
    assert.equal((await owner.put("menu", { menu })).status, 200);
    const pub = await (await fetch(site.u + "/menu.json")).json();
    assert.equal(pub.optionGroups.milk.choices.find((c) => c.name === "Oat milk").out, true, "the app is told it is sold out");
    const tryOat = await order(site, latte({ picks: { temp: ["Hot"], milk: ["Oat milk"] } }));
    assert.equal(tryOat.status, 400);
    assert.match(tryOat.json.error, /Oat milk is sold out today/);
    assert.equal((await order(site, latte({ picks: { temp: ["Hot"], milk: ["Almond milk"] } }))).status, 200, "other milks still work");
    // put it back
    delete menu.optionGroups.milk.choices.find((c) => c.name === "Oat milk").out;
    await owner.put("menu", { menu });
    assert.equal((await order(site, latte({ picks: { temp: ["Hot"], milk: ["Oat milk"] } }))).status, 200);
  } finally { site.close(); }
});

test("backups: a clean copy of the database and the photos, one folder per day, the newest 7 kept", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "maruf-backup-"));
  try {
    assert.equal(backupData(dir), null, "nothing to back up yet");
    const db = new DatabaseSync(path.join(dir, "maruf.db"));
    db.exec("PRAGMA journal_mode = WAL; CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('a request');");
    mkdirSync(path.join(dir, "uploads")); writeFileSync(path.join(dir, "uploads", "p.jpg"), "photo");
    const r = backupData(dir, { day: "2026-01-01" });
    db.exec("INSERT INTO t VALUES ('later')");   // the database is still open and in use: the copy is a snapshot
    const copy = new DatabaseSync(path.join(r.dir, "maruf.db"));
    assert.deepEqual(copy.prepare("SELECT v FROM t").all().map((x) => x.v), ["a request"]);
    copy.close(); db.close();
    assert.ok(existsSync(path.join(r.dir, "uploads", "p.jpg")), "photos are copied");
    for (let d = 2; d <= 9; d++) backupData(dir, { day: `2026-01-0${d}` });
    const days = readdirSync(path.join(dir, "backups")).sort();
    assert.equal(days.length, 7);
    assert.deepEqual([days[0], days[6]], ["2026-01-03", "2026-01-09"], "the oldest are dropped");
    backupData(dir, { day: "2026-01-09" });   // twice in a day replaces that day's copy
    assert.equal(readdirSync(path.join(dir, "backups")).length, 7);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rewards the owner sets: cleaned, smallest first, and nothing until added", async () => {
  const { normalizeContent } = await import("./lib/content.mjs");
  const base = JSON.parse((await import("node:fs")).readFileSync(new URL("./public/content.default.json", import.meta.url), "utf8"));
  assert.deepEqual(normalizeContent(base).content.rewards, [], "none until the owner adds one");
  const good = normalizeContent({ ...base, rewards: [{ points: "200", title: "A free sandwich" }, { points: 100.9, title: "  A free drink " }, { points: 5, title: "" }] });
  assert.deepEqual(good.content.rewards, [{ points: 100, title: "A free drink" }, { points: 200, title: "A free sandwich" }]);
  const bad = normalizeContent({ ...base, rewards: [{ points: "lots", title: "A free drink" }] });
  assert.ok(bad.errors.some((e) => /needs a number of points/.test(e)));
  const site = await startSite();
  try {
    const owner = await site.login();
    const content = (await owner.get("content")).json.content;
    content.rewards = [{ points: 100, title: "A free drink" }];
    assert.equal((await owner.put("content", { content })).status, 200);
    assert.deepEqual((await (await fetch(site.u + "/content.json")).json()).rewards, [{ points: 100, title: "A free drink" }]);
  } finally { site.close(); }
});

test("item labels: only New, Popular or Seasonal are kept", async () => {
  const { normalizeMenu } = await import("./lib/menu.mjs");
  const menu = { currency: "USD", groups: { Drinks: { Coffee: [{ name: "A", cents: 100, badge: "New" }, { name: "B", cents: 100, badge: "Best ever!!" }, { name: "C", cents: 100 }, { name: "D", cents: 100, badge: "Popular" }] } } };
  const items = normalizeMenu(menu).menu.groups.Drinks.Coffee;
  assert.deepEqual(items.map((i) => i.badge), ["New", undefined, undefined, "Popular"]);
});

test("dietary tags: only the known ones are kept, in a fixed order, and none unless the café ticks them", async () => {
  const { normalizeMenu } = await import("./lib/menu.mjs");
  const menu = { currency: "USD", groups: { Food: { Sandwiches: [
    { name: "A", cents: 100, diet: ["Vegan", "Vegetarian", "Gluten-free"] },
    { name: "B", cents: 100, diet: ["Keto", "Nut-free", "Nut-free"] },
    { name: "C", cents: 100, diet: [] },
    { name: "D", cents: 100, diet: "Vegan" },
    { name: "E", cents: 100 },
  ] } } };
  const items = normalizeMenu(menu).menu.groups.Food.Sandwiches;
  assert.deepEqual(items.map((i) => i.diet), [["Vegetarian", "Vegan", "Gluten-free"], ["Nut-free"], undefined, undefined, undefined]);
  const shipped = normalizeMenu(JSON.parse((await import("node:fs")).readFileSync(new URL("./public/menu.json", import.meta.url), "utf8"))).menu;
  assert.ok(!Object.values(shipped.groups).flatMap((c) => Object.values(c).flat()).some((i) => i.diet), "the café's menu starts with no dietary claims: it must tick them itself");
});

test("allergen notes are kept as the café typed them (trimmed, limited), calories are never kept, and both are empty by default", async () => {
  const { normalizeMenu } = await import("./lib/menu.mjs");
  const menu = { currency: "USD", groups: { Drinks: { Coffee: [
    { name: "A", cents: 100, cal: "190", allergens: "  Contains   milk\n and wheat " },
    { name: "B", cents: 100, allergens: "y".repeat(300) },
    { name: "C", cents: 100, allergens: 5 },
    { name: "D", cents: 100 },
  ] } } };
  const items = normalizeMenu(menu).menu.groups.Drinks.Coffee;
  assert.equal(items[0].allergens, "Contains milk and wheat");
  assert.ok(items.every((i) => !("cal" in i)), "calories are dropped: the app does not show them");
  assert.equal(items[1].allergens.length, 120);
  assert.deepEqual([items[2].allergens, items[3].allergens], [undefined, undefined], "only text counts; nothing is invented");
  const shipped = normalizeMenu(JSON.parse((await import("node:fs")).readFileSync(new URL("./public/menu.json", import.meta.url), "utf8"))).menu;
  assert.ok(!Object.values(shipped.groups).flatMap((c) => Object.values(c).flat()).some((i) => i.allergens), "the café's menu starts with no allergen claims");
});

test("amenities: trimmed, limited to 12 of 40 characters, empty by default, and served to the app", async () => {
  const { normalizeContent } = await import("./lib/content.mjs");
  const base = JSON.parse((await import("node:fs")).readFileSync(new URL("./public/content.default.json", import.meta.url), "utf8"));
  assert.deepEqual(normalizeContent(base).content.amenities, [], "none until the café adds some");
  const got = normalizeContent({ ...base, amenities: ["  Free Wi-Fi ", "", "x".repeat(80), ...Array.from({ length: 20 }, (_, i) => `Thing ${i}`)] }).content.amenities;
  assert.equal(got[0], "Free Wi-Fi"); assert.equal(got[1].length, 40); assert.equal(got.length, 12);
  const site = await startSite();
  try {
    const owner = await site.login();
    const content = (await owner.get("content")).json.content;
    content.amenities = ["Free Wi-Fi"];
    assert.equal((await owner.put("content", { content })).status, 200);
    assert.deepEqual((await (await fetch(site.u + "/content.json")).json()).amenities, ["Free Wi-Fi"]);
  } finally { site.close(); }
});
