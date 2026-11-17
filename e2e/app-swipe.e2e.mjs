// The menu scrolls sideways (one category at a time), with a switch to the list, and the app opens with a short animation that never holds anything up.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-swipe.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";

const site = await startSite({});
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });   // a fresh phone: nothing remembered, so the defaults show
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
// the opening is a full-screen dark brown cover that takes no taps, so look for it in the page rather than asking what is under a point
const covered = () => p.evaluate(() => [...document.querySelectorAll("div")].some((d) => getComputedStyle(d).backgroundColor === "rgb(36, 26, 18)" && d.offsetWidth >= window.innerWidth - 2 && d.offsetHeight >= window.innerHeight - 2 && getComputedStyle(d).opacity > 0.3));

// ── the opening: dark brown with the logo at first, the app a moment later ──────────────────────────────────────────────────
const t0 = Date.now();
await p.goto(site.u + "/app/", { waitUntil: "commit" });
let early = false;
for (let i = 0; i < 60 && !early; i++) { early = await covered().catch(() => false); if (!early) await p.waitForTimeout(25); }
ok(early, "the opening animation covers the screen in the café's dark brown first");
await p.screenshot({ path: `${SHOTS}/swipe-0-opening.png` });
await p.getByText("Start an order", { exact: false }).first().waitFor({ timeout: 8000 });
let gone = false, goneAt = 0;
for (let i = 0; i < 80 && !gone; i++) { gone = !(await covered().catch(() => true)); if (gone) goneAt = Date.now() - t0; else await p.waitForTimeout(50); }
ok(gone && goneAt < 2600, `the animation is over and the app is showing within about ${goneAt} ms`);
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.waitForTimeout(150);
ok(!(await covered()), "it does not play again when the page is reloaded in the same tab");

// ── the menu scrolls right, one category at a time ────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByText("Swipe to see more", { exact: false }).first().waitFor({ timeout: 8000 });
ok(await seen("Espresso") && !(await seen("Breakfast Wrap")) && !(await seen("Lemonade")), "the menu shows one category (Coffee) as cards, not the whole menu");
await p.screenshot({ path: `${SHOTS}/swipe-1-menu.png` });
const row = await p.evaluate(() => {
  const rows = [...document.querySelectorAll("div")].filter((d) => d.scrollWidth > d.clientWidth + 40 && getComputedStyle(d).overflowX !== "visible" && d.querySelector("[aria-label*='Details']"));
  const r = rows[0]; if (!r) return null;
  const before = r.scrollLeft; r.scrollBy({ left: 300 }); return { wide: r.scrollWidth > r.clientWidth, before };
});
ok(row && row.wide, "the cards run off to the right, so scrolling right shows more");
await p.waitForTimeout(500);
const after = await p.evaluate(() => { const r = [...document.querySelectorAll("div")].find((d) => d.scrollWidth > d.clientWidth + 40 && d.querySelector("[aria-label*='Details']") && getComputedStyle(d).overflowX !== "visible"); return r ? r.scrollLeft : -1; });
ok(after > 100, "scrolling moved the cards sideways (" + after + "px)");
await p.screenshot({ path: `${SHOTS}/swipe-2-scrolled.png` });

// another category, and ordering still works from a card
await p.getByRole("button", { name: "Refreshers", exact: true }).first().click();
await p.getByRole("button", { name: /^Lemonade,/ }).first().waitFor({ timeout: 8000 });
ok(await seen("Lemonade") && !(await seen("Espresso")), "choosing a category button shows that category's cards");
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
ok(true, "the + on a card adds it to the order");

// the list is one tap away, and the choice is remembered
await p.getByRole("button", { name: "Show the menu as a list", exact: true }).click();
await p.getByRole("button", { name: /^Breakfast Wrap,/ }).first().waitFor({ timeout: 8000 });
ok(true, "List shows every category one under the other");
await p.reload({ waitUntil: "load" });
await p.getByRole("button", { name: "Show the menu as swipe cards", exact: true }).waitFor({ timeout: 8000 });
ok(true, "the choice is remembered after reopening");

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
