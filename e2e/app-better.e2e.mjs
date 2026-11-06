// The everyday things a customer of a good food app expects: browse by category from Home, pick a quantity, keep the order when the app
// closes, see the tax, get offered something else, and follow a placed order from Home.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-better.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const b = await chromium.launch({ executablePath: "" + (process.env.CHROMIUM || "/opt/pw-browsers/chromium") + "" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
// only what a person can see: the screens underneath a modal stay in the page
const shown = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first();
const seen = (text) => shown(text).isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
const orderBar = () => p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).first();

// ── browse by category from Home ───────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByRole("button", { name: /^Burgers, / }).first().scrollIntoViewIfNeeded();
ok(await p.getByRole("button", { name: /^Coffee, 19 items/ }).first().isVisible(), "Home has a row of round category buttons, with how many items each holds");
await p.getByRole("button", { name: /^Burgers, / }).first().click();
let head = null;
for (let i = 0; i < 20 && !(head && head.y > 100 && head.y < 400); i++) {   // the Menu scrolls to the category; give it a moment
  await p.waitForTimeout(250);
  head = await p.getByRole("heading", { name: "Burgers" }).filter({ visible: true }).first().boundingBox().catch(() => null);
}
ok(head && head.y > 100 && head.y < 400, "tapping a category on Home opens the Menu scrolled to that category");

// ── choose how many, then add ─────────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: /^Latte, \$4\.50/ }).first().click();
await button("Add Latte to order").waitFor();
ok(await seen("Add to order · $4.50"), "the item screen starts at one, with the price on the button");
await button("More Latte").click(); await button("More Latte").click();
ok(await seen("Add to order · $13.50"), "choosing 3 puts the total on the button");
await button("Fewer Latte").click();
ok(await seen("Add to order · $9.00"), "and going back to 2 updates it");
ok(await seen("Add something else") && (await p.getByRole("button", { name: /^Add .* to order$/ }).filter({ visible: true }).count()) > 1, "the item screen offers other things to add");
await p.screenshot({ path: `${SHOTS}/better-1-item.png` });
await button("Add Latte to order").click();
await orderBar().waitFor({ timeout: 5000 });
ok((await orderBar().textContent()).includes("(2)") && !(await seen("Add something else")), "adding closes the item screen and the order bar shows 2 items");

// ── change it later ───────────────────────────────────────────────────────────────────────────────────────────────────────────
await p.getByRole("button", { name: /^Latte, \$4\.50/ }).first().click();
await button("View my order").waitFor();
ok(await p.getByLabel("2 Latte").first().isVisible(), "reopening an item in the order starts at the quantity already ordered");
await button("More Latte").click();
ok(await seen("Update order · $13.50"), "changing it offers to update the order");
await button("Update order · $13.50").click();
await p.waitForTimeout(900);
ok((await orderBar().textContent()).includes("(3)"), "the order now has 3");
await p.getByRole("button", { name: /^Latte, \$4\.50/ }).first().click();
for (let i = 0; i < 3; i++) await button("Fewer Latte").click();
await button("Remove from order").waitFor();
await button("Remove from order").click();
await p.waitForTimeout(900);
ok((await p.getByRole("button", { name: /^View my order \(/ }).count()) === 0, "taking the quantity to zero removes it from the order");

// ── the order is kept when the app is closed ──────────────────────────────────────────────────────────────────────────────────────
await p.getByRole("button", { name: "Add Latte to order", exact: true }).first().click();
await p.getByRole("button", { name: "Add Bagel & Cream Cheese to order", exact: true }).first().click().catch(() => {});
await orderBar().waitFor();
const before = await orderBar().textContent();
await p.goto(site.u + "/app/menu", { waitUntil: "load" });   // the same as closing and opening the app
await orderBar().waitFor({ timeout: 5000 });
ok((await orderBar().textContent()) === before, `after closing and reopening, the order is still there (${before})`);

// ── My order: tax, something else, edit ───────────────────────────────────────────────────────────────────────────────────────────
await orderBar().click();
await p.getByRole("button", { name: "Place order for pickup" }).first().waitFor();
await p.waitForTimeout(500);
ok(await seen("Estimated tax (8.875%)") && await seen("Estimated total"), "My order shows the tax as an estimate, and an estimated total");
ok(await seen("Add something else"), "My order offers something else to add");
ok(await p.getByRole("button", { name: "Latte: change options or add a note" }).first().isVisible(), "each line in the order can be opened to change it");
await p.getByRole("button", { name: "Latte: change options or add a note" }).first().click();
await button("Make it your way").waitFor({ timeout: 800 }).catch(() => {});
ok(await seen("Make it your way") || await seen("Temperature"), "opening a line shows the item's options");
await p.goBack();

// ── placing it, then following it from Home ───────────────────────────────────────────────────────────────────────────────────────
await p.getByRole("button", { name: "Place order for pickup" }).first().click();
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
ok(await seen("Estimated total"), "the pickup screen shows the estimated total too");
await button("Place order").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
ok(await seen("Directions"), "the confirmation has a Directions button");
const code = (await p.getByLabel(/^Order code /).first().textContent()).trim();
square.set("PREPARED");
await shown("Ready for pickup").waitFor({ timeout: 25000 });
await button("Done").click();
await p.waitForTimeout(900);
await p.goto(site.u + "/app/", { waitUntil: "load" });   // a fresh start of the app: the order is still followed
await p.getByRole("button", { name: new RegExp(`^Your order ${code}: Ready for pickup`) }).first().waitFor({ timeout: 25000 });
ok(true, `Home shows the order ${code} and says it is ready, even after reopening the app`);
ok((await p.getByRole("button", { name: /^View my order \(/ }).count()) === 0, "the order list was emptied once the order was placed");
await p.screenshot({ path: `${SHOTS}/better-2-home-ready.png` });
await p.getByRole("button", { name: /^Your order / }).first().click();
await p.getByText("Order code", { exact: false }).first().waitFor();
ok(await seen("Ready for pickup") && await seen(code), "tapping the card opens the order screen");
await button("Done").click();
square.set("COMPLETED");
await p.getByRole("button", { name: new RegExp(`^Your order ${code}: Picked up`) }).first().waitFor({ timeout: 30000 });
ok(true, "when the café completes the order, Home says it was picked up");
await p.getByRole("button", { name: "Close order card" }).first().click();
await p.waitForTimeout(500);
ok((await p.getByRole("button", { name: /^Your order / }).count()) === 0, "the card can be closed once the order is picked up");
await p.reload({ waitUntil: "load" });
await p.waitForTimeout(1200);
ok((await p.getByRole("button", { name: /^Your order / }).count()) === 0, "and it stays closed");

// ── clearing the order asks first ──────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Latte to order", exact: true }).first().click();
await orderBar().click();
await button("Clear my order").click();
ok(await seen("Remove everything from your order?"), "Clear my order asks before throwing the order away");
await button("Keep it").click();
ok((await p.getByRole("button", { name: "Place order for pickup" }).count()) > 0 && !(await seen("Remove everything from your order?")), "Keep it leaves the order as it was");
await button("Clear my order").click();
await button("Yes, clear it").click();
ok(await seen("Nothing here yet"), "Yes, clear it empties the order");

// ── closed: the customer is told before ordering ─────────────────────────────────────────────────────────────────────────────────
async function orderPageAt(iso) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.clock.setFixedTime(new Date(iso));
  const q = await c.newPage();
  await q.goto(site.u + "/app/menu", { waitUntil: "load" });
  await q.getByRole("button", { name: "Add Latte to order", exact: true }).first().click();
  await q.getByRole("button", { name: /^View my order \(/ }).first().click();
  await q.getByRole("button", { name: "Place order for pickup" }).first().waitFor();
  await q.waitForTimeout(400);
  const text = await q.locator("body").innerText();
  await c.close();
  return text;
}
const noon = await orderPageAt("2026-01-12T17:00:00Z"), dawn = await orderPageAt("2026-01-12T09:00:00Z");   // Monday, New York noon and 4 AM
ok(!noon.includes("closed right now"), "while the café is open, the order screen says nothing about hours");
ok(dawn.includes("Maruf Cafe is closed right now") && dawn.includes("opens 7 AM") && dawn.includes("may not see your order"), "while it is closed, the order screen says so and when it opens");

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
