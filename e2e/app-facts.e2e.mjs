// Allergen notes the café typed, recent searches, and a greeting with the customer's first name.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-facts.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";

const site = await startSite({});
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("maruf:menu-layout", "list"); sessionStorage.setItem("maruf:opened", "1"); } catch { /* no storage */ } });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);

// nothing is claimed until the café types it
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByText("Espresso", { exact: true }).first().waitFor({ timeout: 8000 });
ok(!(await seen("Contains no milk")), "no allergen note shown while the café has entered none");

const owner = await site.login();
const menu = (await owner.get("menu")).json.menu;
const all = Object.values(menu.groups).flatMap((c) => Object.values(c).flat());
const esp = all.find((i) => i.name === "Espresso"); esp.allergens = "Contains no milk"; esp.cal = "5";   // old data with calories is simply not shown
await owner.put("menu", { menu });

await p.goto(site.u + "/app/menu", { waitUntil: "load" });
ok(!(await seen("5 cal")) && !(await seen("Calories")), "calories are never shown");
await p.getByRole("button", { name: /^Espresso, \$3\.00/ }).first().click();
await p.getByText("Allergens: Contains no milk", { exact: false }).first().waitFor({ timeout: 8000 });
ok(!(await seen("Calories")), "the item page shows the allergen note as typed, and no calories");
ok(await seen("please ask the café before you order"), "and says to ask about allergies");
await p.screenshot({ path: `${SHOTS}/facts-1-item.png` });

// recent searches
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
const search = p.getByRole("textbox", { name: "Search the menu" });
await search.fill("latte"); await search.press("Enter");
await search.fill("");
await search.fill("wrap"); await search.press("Enter");
await search.fill(""); await search.blur();
await search.focus();
await p.getByLabel("Recent searches").waitFor({ timeout: 5000 });
ok(await seen("wrap") && await seen("latte"), "focusing an empty search shows the recent searches");
await p.screenshot({ path: `${SHOTS}/facts-2-recent.png` });
await p.getByRole("button", { name: "Search for latte" }).click();
await p.getByText("for “latte”", { exact: false }).first().waitFor({ timeout: 5000 });
ok(true, "tapping a recent search runs it");
await p.reload({ waitUntil: "load" });
await p.getByRole("textbox", { name: "Search the menu" }).focus();
await p.getByLabel("Recent searches").waitFor({ timeout: 5000 });
ok(true, "recent searches are still there after reopening the app");

// the greeting uses the first name given when ordering
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Start an order", { exact: false }).first().waitFor({ timeout: 8000 });
ok(!(await seen(", Sam")), "no name in the greeting for a new customer");
await p.evaluate(() => localStorage.setItem("maruf:contact", JSON.stringify({ name: "Sam Lee", phone: "7185550123" })));
await p.reload({ waitUntil: "load" });
await p.getByText(/^Good (morning|afternoon|evening), Sam$/).first().waitFor({ timeout: 8000 });
ok(true, "after ordering once, Home greets them by first name");
await p.screenshot({ path: `${SHOTS}/facts-3-greeting.png` });

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
