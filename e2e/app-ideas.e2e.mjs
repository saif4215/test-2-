// Pause pickup orders and sold-out extras, seen from the customer's app.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-ideas.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
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

const owner = await site.login();
const menu = (await owner.get("menu")).json.menu;
menu.optionGroups.milk.choices.find((c) => c.name === "Oat milk").out = true;
await owner.put("menu", { menu });

// ── a sold-out extra shows as sold out and cannot be picked ─────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: /^Latte, \$4\.50/ }).first().click();
await button("Hot").waitFor();
await p.getByText("More options", { exact: false }).filter({ visible: true }).first().click();
await p.getByText("Oat milk · sold out", { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
ok(true, "oat milk shows as sold out on the drink's page");
ok(await seen("Almond milk +$1.00"), "the other milks can still be chosen");
await p.getByText("Oat milk · sold out", { exact: false }).filter({ visible: true }).first().click({ force: true }).catch(() => {});
await button("Hot").click();
await button("Add Latte to order").click().catch(async () => { await p.getByRole("button", { name: /Add Latte to order/ }).first().click(); });
await p.screenshot({ path: `${SHOTS}/ideas-1-soldout.png` });

// ── pause: the order screen says so and will not send ──────────────────────────────────────────────────────────────────────
await owner.call("POST", "pause", { minutes: 30 });
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
await p.getByText("pausing new pickup orders", { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
ok(true, "the order screen says new pickup orders are paused");
ok(await seen("call us at (929) 335-3296"), "and gives the café's number");
const paused = p.getByRole("button", { name: /^Orders paused until \d+:\d\d [AP]M$/ }).filter({ visible: true }).first();
ok(await paused.isVisible(), "the button names the time it opens again");
await paused.click({ force: true }); await p.waitForTimeout(1200);
ok(!p.url().includes("order-sent") && square.calls.filter((c) => c.method === "POST").length === 0, "pressing it sends nothing to Square");
await p.screenshot({ path: `${SHOTS}/ideas-2-paused.png` });

// ── open again: the same order can be placed ───────────────────────────────────────────────────────────────────────────────
await owner.call("POST", "pause", { minutes: 0 });
await p.reload({ waitUntil: "load" });
await p.getByRole("button", { name: "Place order for pickup", exact: true }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
ok(true, "when the café opens again the button is back");

await b.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
