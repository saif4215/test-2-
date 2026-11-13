// Choosing a pickup time on My order: the café's open hours and prep time decide the times, and the chosen time reaches Square as a scheduled pickup.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-pickup.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, PICKUP_MIN_MINUTES: "5", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const a = await site.login(), content = (await a.get("content")).json.content;
content.business.hours = [{ label: "Every day", days: [0, 1, 2, 3, 4, 5, 6], open: 0, close: 24 }];   // open all day, so the test does not depend on the time it runs
await a.put("content", { content });
const b = await chromium.launch({ executablePath: "" + (process.env.CHROMIUM || "/opt/pw-browsers/chromium") + "" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await p.waitForTimeout(500);
ok(await seen("When") && await seen("As soon as possible") && await seen("Choose a time"), "My order asks when: as soon as possible, or a time");
ok(await seen("Earliest time today"), "it says the earliest time and that times are for today");
await button("Choose a time").click();
const first = (await p.getByText(/^\d{1,2}:\d\d (AM|PM)$/).filter({ visible: true }).allTextContents())[0];
ok(!!first, `times are offered (the first is ${first})`);
await p.screenshot({ path: `${SHOTS}/pickup-1-times.png` });

// a time must be chosen
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
ok(await seen("Choose a pickup time, or as soon as possible"), "choosing 'a time' without picking one is explained, and nothing is sent");
ok(square.calls.filter((c) => c.url === "/v2/orders").length === 0, "nothing reached Square yet");

await p.getByText(first, { exact: true }).filter({ visible: true }).first().click();
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
const pd = square.calls.find((c) => c.url === "/v2/orders").json.order.fulfillments[0].pickup_details;
ok(pd.schedule_type === "SCHEDULED" && typeof pd.pickup_at === "string" && pd.pickup_at.endsWith("Z"), "Square received a scheduled pickup with the time");
ok(await seen(`Pickup at ${first} today`), "the confirmation says the pickup time");
await p.screenshot({ path: `${SHOTS}/pickup-2-sent.png` });

// as soon as possible is still the default for the next order
await button("Done").click();
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
const second = square.calls.filter((c) => c.url === "/v2/orders")[1].json.order.fulfillments[0].pickup_details;
ok(second.schedule_type === "ASAP", "the next order is as soon as possible unless a time is chosen");

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
