// My usual drinks and past orders: save a drink the way you like it, add it from Home in one tap, place the order, then order it again from Past orders.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-usual.e2e.mjs
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
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

// ── save a usual from the item screen ─────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: /^Latte, \$4\.50/ }).first().click();
await button("Choose hot or iced before saving").waitFor();
ok(await button("Choose hot or iced before saving").isVisible(), "a drink cannot be saved as a usual until hot or iced is chosen");
await button("Iced").click();
await radioLarge();
async function radioLarge() { await p.getByRole("radio", { name: "Size: Large, $5.50" }).filter({ visible: true }).first().click(); }
await shown("More options").click();
await p.getByText("Oat milk +$1.00", { exact: true }).filter({ visible: true }).first().click();
function shown(t) { return p.getByText(t, { exact: false }).filter({ visible: true }).first(); }
await button("Save Latte, Large, Iced, Oat milk, as my usual").click();
await button("Saved to My usuals").waitFor();
ok(true, "saving shows that it is saved");

// ── it is on Home, and one tap puts it in the order exactly as saved ──────────────────────────────────────────────────────────
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("My usuals", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await seen("Large, Iced, Oat milk"), "Home shows My usuals with the size and choices");
ok(await seen("$6.50"), "and what it costs");
await p.screenshot({ path: `${SHOTS}/usual-1-home.png` });
await p.getByRole("button", { name: /^Add Latte · Large, Iced, Oat milk to my order$/ }).first().click();
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await p.waitForTimeout(400);
ok(await seen("Large, Iced, Oat milk") && await seen("$6.50 each"), "My order has the drink as saved");

// ── place it; it joins Past orders ────────────────────────────────────────────────────────────────────────────────────────────
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
await button("Done").click();
await p.goto(site.u + "/app/", { waitUntil: "load" });
await button("See past orders").waitFor({ timeout: 8000 });
await button("See past orders").click();
await p.getByText("Past orders", { exact: true }).filter({ visible: true }).first().waitFor();
await p.waitForTimeout(400);
ok(await seen("1 × Latte") && await seen("Large, Iced, Oat milk") && await seen("Subtotal $6.50"), "Past orders lists the order with its choices and subtotal");
await p.screenshot({ path: `${SHOTS}/usual-2-history.png` });
await p.getByRole("button", { name: /^Order the .* order again$/ }).first().click();
await button("Place order for pickup").waitFor();
await p.waitForTimeout(400);
ok(await seen("Large, Iced, Oat milk") && await seen("$6.50 each"), "Order this again puts it back in My order with the same choices");

// ── remove a usual ────────────────────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByRole("button", { name: /^Remove Latte · Large, Iced, Oat milk from my usuals$/ }).first().click();
await p.waitForTimeout(500);
ok(!(await seen("My usuals")), "removing the only usual removes the row");

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
