// A planned tip on the order screen: choose a percentage or type an amount; the café sees it as a note and the total does not change.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-tips.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
square.loyalty(false);
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("maruf:menu-layout", "list"); } catch { /* no storage */ } });   // these tests are about ordering, so they use the list layout; app-swipe.e2e.mjs covers the swipe one
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

// $13.50 before tax: the wrap ($10.00) and a lemonade ($3.50)
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Breakfast Wrap to order", exact: true }).first().click();
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(2\)/ }).filter({ visible: true }).first().click();
await p.getByText("Add a tip (optional)", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await seen("No tip") && await seen("15% · $2.03") && await seen("20% · $2.70") && await seen("25% · $3.38"), "the tip choices show their amounts for this order");
ok(await seen("A tip is not charged now"), "and say it is not charged now");
await button("20% · $2.70").click();
ok(await seen("Tip planned: $2.70."), "choosing 20% shows the planned tip");
ok(await seen("Estimated total") && await seen("$14.70"), "the estimated total does not include the tip");
await p.screenshot({ path: `${SHOTS}/tips-1-order.png` });

await button("Other").click();
await p.getByRole("textbox", { name: /Tip in dollars/ }).fill("abc");
ok(await seen("Type a tip like 2 or 2.50."), "a tip that is not an amount is explained");
await p.getByRole("textbox", { name: /Tip in dollars/ }).fill("3");
ok(await seen("Tip planned: $3.00."), "a typed amount works");

await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
const sent = [...square.calls].reverse().find((c) => c.method === "POST" && c.url === "/v2/orders").json.order;
ok(sent.fulfillments[0].pickup_details.note === "Tip planned: $3.00. Add it when the customer pays.", "Square's order carries the tip as a note for the cashier: " + sent.fulfillments[0].pickup_details.note);
ok(!sent.service_charges && sent.line_items.length === 2, "and nothing was added to the order's price");

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
