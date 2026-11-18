// After pickup the customer can rate the order; the café reads it in the dashboard. Also: amenities from the dashboard show on Contact.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-rate.e2e.mjs
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

// ── amenities: nothing until the café adds some ───────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/contact", { waitUntil: "load" });
await p.getByText("Gift card balance", { exact: true }).first().waitFor({ timeout: 8000 });
ok(!(await seen("Good to know")), "no Good to know card while the café has listed nothing");
const owner = await site.login();
const content = (await owner.get("content")).json.content;
content.amenities = ["Free Wi-Fi", "Outdoor seating"];
ok((await owner.put("content", { content })).status === 200, "the café saved its amenities");
await p.goto(site.u + "/app/contact", { waitUntil: "load" });
await p.getByText("Good to know", { exact: true }).first().waitFor({ timeout: 8000 });
ok(await seen("Free Wi-Fi") && await seen("Outdoor seating"), "the Contact tab shows them as small tags");
await p.screenshot({ path: `${SHOTS}/rate-0-amenities.png` });

// ── an order, picked up, then rated ───────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
ok(!(await seen("How was your order?")), "no rating card before the order is picked up");
square.set("COMPLETED");
await p.getByText("How was your order?", { exact: true }).first().waitFor({ timeout: 45000 });
ok(true, "once it is picked up, the rating card appears");
await button("Send").click({ force: true }).catch(() => {}); await p.waitForTimeout(800);
ok((await owner.get("feedback")).json.count === 0 && (await seen("How was your order?")), "Send does nothing until a star rating is chosen");
await p.getByRole("radio", { name: "4 stars" }).click();
await p.getByRole("textbox", { name: "Comment about your order" }).fill("Lovely lemonade, a bit sweet.");
await p.screenshot({ path: `${SHOTS}/rate-1-card.png` });
await button("Send").click();
await p.getByText("Thank you for telling us how it went.", { exact: false }).first().waitFor({ timeout: 8000 });
ok(true, "sending says thank you");
await p.reload({ waitUntil: "load" });
await p.getByText("Thank you for telling us how it went.", { exact: false }).first().waitFor({ timeout: 15000 });
ok(!(await seen("How was your order?")), "and it is not asked again for the same order");

// ── the café reads it ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const f = (await owner.get("feedback")).json;
ok(f.count === 1 && f.average === 4 && f.items[0].comment === "Lovely lemonade, a bit sweet." && f.items[0].name === "Sam Lee", "the dashboard has the rating, the comment and the name");
const staff = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const a = await staff.newPage();
a.on("pageerror", (e) => fails.push("dashboard pageerror: " + e.message));
await a.goto(site.u + "/admin/");
await a.fill("#p", "owner-pass-12345"); await a.click("button.primary");
await a.getByRole("button", { name: "Feedback", exact: true }).click();
await a.getByText("4 out of 5, from 1 rating", { exact: false }).waitFor({ timeout: 8000 });
ok(await a.getByText("Lovely lemonade, a bit sweet.").isVisible(), "the Feedback tab shows the average and the comment");
await a.screenshot({ path: `${SHOTS}/rate-2-dashboard.png` });

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
