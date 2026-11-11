// Choosing a size and extras (the café's real menu): the price follows each choice, the order shows them, and Square receives them priced by the server.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-customize.e2e.mjs
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
const shown = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first();
const seen = (text) => shown(text).isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
const radio = (name) => p.getByRole("radio", { name }).filter({ visible: true }).first();

// ── a drink with sizes, hot or iced, milk, syrup and foam ─────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: /^Latte, \$4\.50 – \$5\.50/ }).first().click();
await button("Add Latte to order").waitFor();
ok(await seen("Add to order · $4.50"), "a latte starts at the Small price");
ok(await seen("Small") && await seen("Large") && await seen("$5.50"), "both sizes are shown with their prices");
await radio("Size: Large, $5.50").click();
ok(await seen("Add to order · $5.50"), "choosing Large moves the price to $5.50");
await button("Iced").click().catch(async () => { await p.getByText("Iced", { exact: true }).filter({ visible: true }).first().click(); });
ok(await seen("Add to order · $5.50"), "hot or iced is free");
await shown("More options").click();
await p.getByText("Oat milk +$1.00", { exact: true }).filter({ visible: true }).first().click();
ok(await seen("Add to order · $6.50"), "oat milk adds $1.00");
await p.getByText("Vanilla +$0.50", { exact: true }).filter({ visible: true }).first().click();
ok(await seen("Add to order · $7.00"), "a syrup adds $0.50");
await p.getByText("Caramel +$0.50", { exact: true }).filter({ visible: true }).first().click();
ok(await seen("Add to order · $7.50"), "a second syrup adds another $0.50");
await p.getByText("Oat milk +$1.00", { exact: true }).filter({ visible: true }).first().click();
ok(await seen("Add to order · $6.50"), "tapping oat milk again takes it off");
await p.getByText("Oat milk +$1.00", { exact: true }).filter({ visible: true }).first().click();
ok(await seen("Your pick") && await seen("Large, Iced, Oat milk, Vanilla, Caramel"), "the choices are summed up in one line");
await p.screenshot({ path: `${SHOTS}/customize-1-latte.png` });
await button("Add Latte to order").click();
await p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).first().waitFor({ timeout: 5000 });

// ── a food item with a required choice, and one with paid add-ons ─────────────────────────────────────────────────────────────
await p.getByRole("button", { name: /^2pc Tenders, \$6\.00/ }).first().scrollIntoViewIfNeeded();
await p.getByRole("button", { name: /^2pc Tenders, \$6\.00/ }).first().click();
await button("Add 2pc Tenders to order").waitFor();
ok(await seen("Hot or regular") && await seen("Choose one"), "tenders ask hot or regular");
ok(await seen("Your pick") && await seen("Regular"), "the first choice is already picked, so the order always says which");
await p.getByText("Hot", { exact: true }).filter({ visible: true }).first().click();
await button("Add 2pc Tenders to order").click();
await p.getByRole("button", { name: /^Egg & Cheese, \$3\.50/ }).first().click();
await button("Add Egg & Cheese to order").waitFor();
await p.getByText("Avocado +$2.00", { exact: true }).filter({ visible: true }).first().click();
ok(await seen("Add to order · $5.50"), "an add-on adds its price to breakfast");
await button("Add Egg & Cheese to order").click();

// ── My order shows each line's choices and price ──────────────────────────────────────────────────────────────────────────────
await p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).first().click();
await p.getByRole("button", { name: "Place order for pickup" }).first().waitFor();
await p.waitForTimeout(400);
ok(await seen("Large, Iced, Oat milk, Vanilla, Caramel") && await seen("$7.50 each"), "My order shows the drink's size and choices and its price each");
ok(await seen("Hot") && await seen("Bagel, Avocado"), "and the food's choices");
ok(await seen("Subtotal"), "with a subtotal (it is exact: every size is chosen)");
await p.screenshot({ path: `${SHOTS}/customize-2-order.png` });
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
const lines = square.calls.find((c) => c.url === "/v2/orders").json.order.line_items;
const by = (n) => lines.find((l) => l.name === n);
ok(by("Latte (Large)")?.base_price_money.amount === 750 && /Iced/.test(by("Latte (Large)").note) && /Oat milk/.test(by("Latte (Large)").note) && /Vanilla, Caramel/.test(by("Latte (Large)").note), "Square got the latte as Large at $7.50, with the choices on it for whoever makes it");
ok(by("2pc Tenders")?.base_price_money.amount === 600 && /Hot or regular: Hot/.test(by("2pc Tenders").note), "Square got the tenders with Hot");
ok(by("Egg & Cheese")?.base_price_money.amount === 550 && /Bagel or croissant: Bagel; Add on: Avocado/.test(by("Egg & Cheese").note), "Square got the breakfast with its bread and add-on");

// ── Reorder brings the same drink back ────────────────────────────────────────────────────────────────────────────────────────
await button("Done").click();
await p.waitForTimeout(700);
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByRole("button", { name: "Reorder my last order" }).first().click();
await p.getByRole("button", { name: "Place order for pickup" }).first().waitFor();
await p.waitForTimeout(400);
ok(await seen("Large, Iced, Oat milk, Vanilla, Caramel"), "Reorder brings back the same size and choices");

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
