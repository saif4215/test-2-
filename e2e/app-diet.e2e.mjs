// Dietary tags: the café ticks them in the dashboard; the app shows them, lets a customer filter the menu, and says to ask about allergies.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-diet.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";

const site = await startSite({});
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("maruf:menu-layout", "list"); } catch { /* no storage */ } });   // these tests are about ordering, so they use the list layout; app-swipe.e2e.mjs covers the swipe one
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);

// nothing is claimed until the café ticks it
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByText("Espresso", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await p.getByLabel("Dietary filters").count() === 0, "no dietary filter row while no item has a tag");

// the café ticks a few tags
const owner = await site.login();
const menu = (await owner.get("menu")).json.menu;
const all = Object.values(menu.groups).flatMap((c) => Object.values(c).flat());
const tag = (name, diet) => { all.find((i) => i.name === name).diet = diet; };
tag("Espresso", ["Vegan", "Gluten-free"]);
tag("Lemonade", ["Vegan"]);
tag("Breakfast Wrap", ["Vegetarian"]);
ok((await owner.put("menu", { menu })).status === 200, "the café saved the tags");

await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByLabel("Dietary filters").waitFor({ timeout: 8000 });
ok(await seen("Vegan · Gluten-free"), "an item shows its tags on the menu line");
await p.screenshot({ path: `${SHOTS}/diet-1-menu.png` });
await p.getByLabel("Dietary filters").getByText("Vegan", { exact: true }).click();
await p.waitForTimeout(600);
ok(await seen("Espresso") && await seen("Lemonade") && !(await seen("Breakfast Wrap")), "choosing Vegan shows only the vegan items");
ok(!(await seen("Drip")), "and hides the rest of the menu");
await p.screenshot({ path: `${SHOTS}/diet-2-vegan.png` });
await p.getByLabel("Dietary filters").getByText("Vegan", { exact: true }).click();
await p.waitForTimeout(600);
ok(await seen("Drip") || await seen("Americano"), "tapping it again shows everything");

// the item page
await p.getByRole("button", { name: /^Espresso, \$3\.00/ }).first().click();
await p.getByText("Recipes and ingredients can change", { exact: false }).first().waitFor({ timeout: 8000 });
ok(await seen("Gluten-free") && await seen("If you have an allergy, please ask the café"), "the item page shows the tags and says to ask about allergies");
await p.screenshot({ path: `${SHOTS}/diet-3-item.png` });

// the dashboard keeps the tags when the menu is saved there
const back = (await owner.get("menu")).json.menu;
ok(Object.values(back.groups).flatMap((c) => Object.values(c).flat()).find((i) => i.name === "Espresso").diet.join() === "Vegan,Gluten-free", "tags are stored in a fixed order");

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
