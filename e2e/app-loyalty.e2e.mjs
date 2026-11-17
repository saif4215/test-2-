// Points kept in Square Loyalty: the order screen offers "Earn points", the account is made in Square from the phone number, and Home shows the balance Square holds.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-loyalty.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000", RATE_LIMIT_PER_MIN: "1000" });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

// ── Home before any order: points live in Square, so it asks for the phone number ─────────────────────────────────────────────────
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Maruf Cafe points", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await seen("kept by Maruf Cafe in Square"), "Home says the points are kept in Square");
await p.getByRole("textbox", { name: /Your phone number/ }).fill("7185550123");
await button("Show my points").click();
await p.getByText("No points yet for this number", { exact: false }).first().waitFor({ timeout: 8000 });
ok(await seen("10 more points until A free cookie (10 points)"), "a new number sees the café's first reward as the goal");
await p.screenshot({ path: `${SHOTS}/loyalty-1-home.png` });

// ── order with "Earn points" ticked (it is by default) ─────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Breakfast Wrap to order", exact: true }).first().click();
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(2\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
const box = p.getByRole("checkbox", { name: "Earn points with this phone number" }).filter({ visible: true }).first();
await box.scrollIntoViewIfNeeded();
const checked = await box.getAttribute("aria-checked");
ok(checked === "true", "Earn points is ticked by default on the order screen (aria-checked=" + checked + ")");
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await p.screenshot({ path: `${SHOTS}/loyalty-2-order.png` });
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
ok(square.accounts.size === 1 && [...square.accounts.values()][0].mapping.phone_number === "+17185550123", "Square has a loyalty account for the phone number");

// ── picked up: Square counts the points (the server does it, whether or not the app is open) ───────────────────────────────────────
square.set("COMPLETED");
await p.goto(site.u + "/app/", { waitUntil: "load" });
let balance = 0;
for (let i = 0; i < 20 && balance < 13; i++) { await p.waitForTimeout(2000); balance = [...square.accounts.values()][0].balance; }
ok(balance === 13, "Square holds 13 points for the $13.50 order (tax does not count): " + balance);
await p.reload({ waitUntil: "load" });
await p.getByText("13 points", { exact: true }).first().waitFor({ timeout: 10000 });
ok(await seen("87 more points until A free drink (100 points)") || await seen("until A free drink"), "Home shows the balance from Square and the next reward");
await p.screenshot({ path: `${SHOTS}/loyalty-3-balance.png` });
ok(await seen("You can use") && await seen("A free cookie"), "a reward they have enough points for is shown");
ok(await seen("applies it in Square checkout"), "and says the cashier applies it in Square checkout");

// ── opting out: untick it and no account is made for a new number ─────────────────────────────────────────────────────────────
const accountsBefore = square.accounts.size;
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
const box2 = p.getByRole("checkbox", { name: "Earn points with this phone number" }).filter({ visible: true }).first();
await box2.scrollIntoViewIfNeeded(); await box2.click();
ok((await box2.getAttribute("aria-checked")) === "false", "it can be unticked");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("9295550199");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
ok(square.accounts.size === accountsBefore, "an order placed without ticking makes no account in Square");
await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
