// "I'm here" and "What's new": a customer taps I'm here for a pickup order and the dashboard shows them; items labelled New show in a row on Home.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-here.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
square.loyalty(false);
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await phone.addInitScript(() => { try { localStorage.setItem("maruf:menu-layout", "list"); } catch { /* no storage */ } });
const p = await phone.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

// ── What's new: nothing until the café labels an item, then a row on Home ───────────────────────────────────────────────────────
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Start an order", { exact: false }).first().waitFor({ timeout: 8000 });
ok(!(await seen("What's new")), "no What's new row while nothing is labelled");
const owner = await site.login();
const menu = (await owner.get("menu")).json.menu;
Object.values(menu.groups).flatMap((c) => Object.values(c).flat()).find((i) => i.name === "Lemonade").badge = "New";
await owner.put("menu", { menu });
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("What's new", { exact: true }).first().waitFor({ timeout: 10000 });
ok(await seen("Lemonade"), "an item labelled New appears under What's new on Home");

// ── order, then I'm here ──────────────────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
await button("I'm here. Tell the café I have arrived").waitFor({ timeout: 8000 });
ok(true, "the order screen offers I'm here");
await p.screenshot({ path: `${SHOTS}/here-1-button.png` });
await button("I'm here. Tell the café I have arrived").click();
await p.getByText("The café knows you're here", { exact: false }).first().waitFor({ timeout: 8000 });
ok(true, "tapping it says the café knows");
await p.screenshot({ path: `${SHOTS}/here-2-sent.png` });

// ── the dashboard shows who is waiting, and Got it clears it ───────────────────────────────────────────────────────────────────
const staff = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const a = await staff.newPage();
a.on("pageerror", (e) => fails.push("dashboard pageerror: " + e.message));
await a.goto(site.u + "/admin/");
await a.fill("#p", "owner-pass-12345"); await a.click("button.primary");
await a.getByText("A customer is here for pickup", { exact: true }).waitFor({ timeout: 10000 });
ok(await a.getByText(/Sam Lee · order [A-Z0-9]{4} · /).isVisible(), "the dashboard shows the customer's name, the order code and how long ago");
await a.screenshot({ path: `${SHOTS}/here-3-dashboard.png` });
await a.getByRole("button", { name: "Got it" }).click();
await a.waitForTimeout(800);
ok(!(await a.getByText("A customer is here for pickup", { exact: true }).isVisible().catch(() => false)), "Got it clears them from the list");

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
