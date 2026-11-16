// Promotions and points on Home: a promotion the owner adds shows (and one past its last day does not), and points arrive once, when the café's Square says the order was picked up.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-points.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const a = await site.login(), content = (await a.get("content")).json.content;
content.promotions = [{ title: "Free cookie with any large drink", text: "Ask for it at the counter.", until: "" }, { title: "Old summer special", text: "ended", until: "2020-08-31" }];
content.rewards = [{ points: 100, title: "A free drink" }, { points: 10, title: "A free cookie" }];
content.rewardsNote = "Ask at the counter what your points can be used for.";
await a.put("content", { content });
const menu = (await a.get("menu")).json.menu;
Object.values(menu.groups).flatMap((c) => Object.values(c).flat()).find((i) => i.name === "Lemonade").badge = "New";
await a.put("menu", { menu });
const b = await chromium.launch({ executablePath: "" + (process.env.CHROMIUM || "/opt/pw-browsers/chromium") + "" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Free cookie with any large drink", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await seen("Ask for it at the counter."), "the owner's promotion shows on Home");
ok(!(await seen("Old summer special")), "a promotion past its last day does not");
ok(await seen("0 points") && await seen("Earn 1 point for every $1") && await seen("Ask at the counter what your points can be used for."), "Home shows the points (none yet), how they are earned, and the owner's note");
await p.screenshot({ path: `${SHOTS}/points-1-home.png` });

// order $13.50 before tax: the wrap ($10.00) and a lemonade ($3.50)
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByLabel("Label: New").first().waitFor({ timeout: 8000 });
ok(true, "an item the café labelled New shows the label on the menu");
await p.getByRole("button", { name: "Add Breakfast Wrap to order", exact: true }).first().click();
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(2\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Your order", { exact: false }).first().waitFor({ timeout: 10000 });
ok(await seen("0 points"), "no points while the order is only placed");
ok(await seen("10 more points until A free cookie (10 points)"), "Home shows the nearest goal and how far away it is");

// the café completes it in Square: the points arrive (13 whole dollars, the tax is not counted), once
square.set("COMPLETED");
await p.getByText("13 points", { exact: true }).first().waitFor({ timeout: 40000 });
ok(true, "after the café completes the order in Square, Home shows 13 points");
await p.reload({ waitUntil: "load" });
await p.waitForTimeout(2500);
ok(await seen("13 points") && !(await seen("26 points")), "reopening the app does not count them again");
await p.screenshot({ path: `${SHOTS}/points-2-earned.png` });

// 13 points is enough for the 10-point reward: use it at the counter, and the points come off
ok(await seen("87 more points until A free drink (100 points)"), "the goal moves as points arrive");
await p.getByRole("button", { name: "Use A free cookie for 10 points", exact: true }).click();
await p.getByText("Show this to the café", { exact: false }).first().waitFor();
await p.screenshot({ path: `${SHOTS}/points-3-use.png` });
await button("Not now").click();
ok(await seen("13 points"), "Not now keeps the points");
await p.getByRole("button", { name: "Use A free cookie for 10 points", exact: true }).click();
await button("Done: take 10 points off").click();
await p.getByText("3 points", { exact: true }).first().waitFor({ timeout: 8000 });
ok(true, "Done takes the 10 points off");
await p.reload({ waitUntil: "load" }); await p.waitForTimeout(2000);
ok(await seen("3 points") && !(await seen("13 points")), "and it stays that way after reopening the app");

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
