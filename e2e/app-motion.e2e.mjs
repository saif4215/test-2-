// Starbucks-style extras with motion: the cup that fills as the order moves along, the live drink cup in "Make it your way", the weekly streak,
// the birthday treat, and counting points. Also: nothing moves (and nothing breaks) for people who asked for less motion.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-motion.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
square.loyalty(false);
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const a = await site.login(), content = (await a.get("content")).json.content;
content.birthdayTreat = "a free cookie with any drink";
content.rewards = [{ points: 100, title: "A free drink" }, { points: 50, title: "A free cookie" }];
await a.put("content", { content });
const b = await chromium.launch({ executablePath: "" + (process.env.CHROMIUM || "/opt/pw-browsers/chromium") + "" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";

// What the phone remembers: orders in each of the last 3 weeks (a streak of 3), 60 points, a name, and a birthday that is today.
const seed = () => {
  const now = new Date(), today = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const ago = (days) => now.getTime() - days * 86400000;
  const entry = (at) => ({ at, subtotal: 450, lines: [{ id: "x", qty: 1 }] });
  try {
    localStorage.setItem("maruf:menu-layout", "list");
    localStorage.setItem("maruf:history", JSON.stringify([entry(ago(0.2)), entry(ago(7)), entry(ago(14))]));
    localStorage.setItem("maruf:points", JSON.stringify({ balance: 60, awarded: [] }));
    localStorage.setItem("maruf:contact", JSON.stringify({ name: "Sam Lee", phone: "7185550123" }));
    localStorage.setItem("maruf:birthday", today);
  } catch { /* no storage */ }
};
const open = async (opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts });
  await ctx.addInitScript(seed);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  return { ctx, p };
};
const seenIn = (p) => (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
// The biggest cup on screen is the one on the current screen (Home's little cup can still be underneath it).
const BIGGEST = `(() => { const cups = [...document.querySelectorAll("[data-cup='1']")].map((e) => ({ e, r: e.getBoundingClientRect() })).filter((c) => c.r.width > 0 && c.r.height > 0).sort((a, b) => b.r.height - a.r.height); return cups.length ? cups[0].e : null; })()`;
const cup = (p) => ({
  isVisible: async () => !!(await p.evaluate(`!!${BIGGEST}`)),
  attr: async (name) => p.evaluate(`(${BIGGEST} || {}).dataset ? ${BIGGEST}.dataset["${name}"] : null`),
});
const level = async (p) => Number(await cup(p).attr("level"));

// ── Home: the streak, the birthday, the points count ─────────────────────────────────────────────────
{
  const { ctx, p } = await open();
  const seen = seenIn(p);
  await p.goto(site.u + "/app/", { waitUntil: "load" });
  await p.getByText("weeks in a row", { exact: false }).first().waitFor({ timeout: 8000 });
  ok(await seen("3 weeks in a row"), "Home shows a 3-week streak from the orders on the phone");
  ok((await p.getByLabel(/ordered|you ordered/).count()) >= 1 || (await p.locator("[aria-label*='you ordered']").count()) >= 1, "this week's day with an order is marked");
  ok(await seen("Happy birthday, Sam!") && await seen("Your treat: a free cookie with any drink"), "in the birthday week Home wishes the customer happy birthday and shows the café's treat");
  await p.waitForTimeout(1200);
  ok(await seen("60 points") && await seen("40 more points until A free drink"), "the points count up to 60 and the next goal shows");
  ok(await p.getByRole("button", { name: "Use A free cookie for 50 points" }).filter({ visible: true }).first().isVisible(), "a reward the customer can already use is offered (with a glow)");
  await p.screenshot({ path: `${SHOTS}/motion-1-home.png` });
  await ctx.close();
}

// ── a customer who has not given a birthday is only invited; the settings take it, and forget it ──────
{
  const { ctx, p } = await open();
  await p.addInitScript(() => { try { localStorage.removeItem("maruf:birthday"); } catch { /* none */ } });
  const seen = seenIn(p);
  await p.goto(site.u + "/app/settings", { waitUntil: "load" });
  await p.getByText("Your birthday", { exact: true }).first().waitFor({ timeout: 8000 });
  ok(await seen("Maruf Cafe has a birthday treat for you: a free cookie with any drink"), "Settings offers the birthday field when the café has a treat");
  await p.getByRole("textbox", { name: "Birthday (month and day)" }).fill("13/45");
  await p.getByRole("button", { name: "Save birthday", exact: true }).click();
  ok(await seen("Type a month and day like 3/14."), "an impossible birthday is explained");
  await p.getByRole("textbox", { name: "Birthday (month and day)" }).fill("3/14");
  await p.getByRole("button", { name: "Save birthday", exact: true }).click();
  ok((await p.getByRole("textbox", { name: "Birthday (month and day)" }).inputValue()) === "March 14", "a real birthday is saved and shown as month and day");
  ok((await p.evaluate(() => localStorage.getItem("maruf:birthday"))) === "03-14", "only the month and day are kept");
  await p.getByRole("button", { name: "Forget it", exact: true }).click();
  ok((await p.evaluate(() => localStorage.getItem("maruf:birthday"))) === "", "it can be forgotten");
  await ctx.close();
}

// ── the order: the birthday treat joins the order note; the cup fills as the order moves ──────────────
{
  const { ctx, p } = await open();
  const seen = seenIn(p);
  const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
  await p.goto(site.u + "/app/menu", { waitUntil: "load" });
  await p.getByRole("button", { name: "Choose options for Latte", exact: true }).first().click();
  await p.waitForTimeout(500);
    ok(await cup(p).isVisible(), "a drink's screen shows a cup under 'Make it your way'");
  ok((await cup(p).attr("iced")) === "0", "the cup is hot to begin with");
  await button("Hot").click();
  await button("Iced").click();
  await p.waitForTimeout(400);
  ok((await cup(p).attr("iced")) === "1", "choosing Iced puts ice and a straw in the cup");
  await p.screenshot({ path: `${SHOTS}/motion-2-customize.png` });
  await button("Add Latte to order").click();
  await p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).first().waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).first().click();
  await p.getByRole("button", { name: "Place order for pickup" }).first().waitFor();
  ok(await seen("Happy birthday! Add my treat: a free cookie with any drink"), "the order screen offers the birthday treat in the birthday week");
  await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
  await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
  await p.getByRole("textbox", { name: "Anything the café should know?" }).fill("no ice please").catch(() => {});
  await button("Place order for pickup").click();
  await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
  const placed = [...square.orders.values()].pop();
  const note = JSON.stringify(placed.fulfillments?.[0]?.pickup_details?.note || "");
  ok(/Birthday treat: a free cookie with any drink\./.test(note), `Square got the birthday treat in the order note (${note})`);
  ok(await cup(p).isVisible() && (await level(p)) < 0.3, "the order screen shows a nearly empty cup while the order is only sent");
  ok((await cup(p).attr("steam")) === "0", "no steam yet");
  await p.screenshot({ path: `${SHOTS}/motion-3-sent.png` });
  square.set("RESERVED");
  await p.waitForFunction(() => { const c = [...document.querySelectorAll("[data-cup='1']")].sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]; return c && Number(c.dataset.level) > 0.5 && Number(c.dataset.level) < 0.9; }, null, { timeout: 30000 });
  ok((await cup(p).attr("bubbles")) === "1", "when the café accepts, the cup is half full and bubbling");
  await p.screenshot({ path: `${SHOTS}/motion-4-making.png` });
  square.set("PREPARED");
  await p.waitForFunction(() => { const c = [...document.querySelectorAll("[data-cup='1']")].sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]; return c && Number(c.dataset.level) === 1; }, null, { timeout: 30000 });
  ok((await cup(p).attr("steam")) === "1", "when it is ready, the cup is full and steaming");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${SHOTS}/motion-5-ready.png` });
  await ctx.close();
}

// ── less motion: it all still works, and the numbers are simply there ─────────────────────────────────
{
  const { ctx, p } = await open({ reducedMotion: "reduce" });
  const seen = seenIn(p);
  await p.goto(site.u + "/app/", { waitUntil: "load" });
  await p.getByText("weeks in a row", { exact: false }).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(100);
  ok(await seen("3 weeks in a row") && await seen("60 points"), "with reduced motion the streak and points are there at once");
  await ctx.close();
}

await b.close(); await site.close(); square.close?.();
if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); }
console.log("\nAll motion checks passed.");
