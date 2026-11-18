// Gift card balance on the Contact tab, and "Picked for you" on Home after an order.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-giftcard.e2e.mjs
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
await ctx.addInitScript(() => { try { localStorage.setItem("maruf:menu-layout", "list"); sessionStorage.setItem("maruf:opened", "1"); } catch { /* no storage */ } });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

// ── gift card balance ───────────────────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/contact", { waitUntil: "load" });
await p.getByText("Gift card balance", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await button("Check balance").isVisible(), "the Contact tab has a gift card balance card");
const field = p.getByRole("textbox", { name: /Card number/ });
await field.fill("1111 2222 3333 4444");
await button("Check balance").click();
await p.getByText("couldn't find that gift card", { exact: false }).first().waitFor({ timeout: 8000 });
ok(true, "an unknown card is explained in plain words");
await field.fill("7783 3200 0123 4567");
await button("Check balance").click();
await p.getByText("$25.50", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await seen("Pay with it at the counter"), "a real card shows its balance");
await p.screenshot({ path: `${SHOTS}/gift-1-balance.png` });
ok(!(await seen("7783")), "the card number is not repeated back on the page");
await field.fill("7783 3200 0999 9999");
await button("Check balance").click();
await p.getByText("not active right now", { exact: false }).first().waitFor({ timeout: 8000 });
ok(true, "a switched-off card says it has no balance to use");

// ── Picked for you: nothing before an order, then untried items from the categories they ordered from ──────────────────────
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Start an order", { exact: false }).first().waitFor({ timeout: 8000 });
ok(!(await seen("Picked for you")), "no Picked for you row before a first order");
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Picked for you", { exact: true }).first().waitFor({ timeout: 10000 });
ok(await seen("Picked for you"), "after an order, Home shows Picked for you");
const labels = await p.evaluate(() => {
  let el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent === "Picked for you");
  while (el && !el.querySelector("[aria-label$='Details']")) el = el.parentElement;
  return el ? [...el.querySelectorAll("[aria-label$='Details']")].map((e) => e.getAttribute("aria-label")) : [];
});
ok(labels.length >= 1 && !labels.some((l) => /^Lemonade,/.test(l)), "the row suggests other items, not the drink they just ordered: " + labels.slice(0, 3).join(" | "));
await p.screenshot({ path: `${SHOTS}/gift-2-picked.png` });

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
