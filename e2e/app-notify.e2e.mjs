// "Tell me when it's ready": the customer turns it on, and a notification is shown when the café marks the order ready (once).
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-notify.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
square.loyalty(false);
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["notifications"] });
await ctx.addInitScript(() => {
  try { localStorage.setItem("maruf:menu-layout", "list"); sessionStorage.setItem("maruf:opened", "1"); } catch { /* no storage */ }
  // record what would have been shown
  window.__notes = [];
  if (window.ServiceWorkerRegistration) ServiceWorkerRegistration.prototype.showNotification = function (title, options) { window.__notes.push({ title, body: options && options.body, tag: options && options.tag }); return Promise.resolve(); };
});
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
await button("Place order for pickup").waitFor();
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await button("Place order for pickup").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });

await button("Tell me when it's ready").waitFor({ timeout: 8000 });
ok(await seen("Works while this app is open or running in the background"), "the button says honestly when it works");
await p.screenshot({ path: `${SHOTS}/notify-1-button.png` });
ok((await p.evaluate(() => window.__notes.length)) === 0, "nothing is shown before they turn it on");
await button("Tell me when it's ready").click();
await p.getByText("We'll let you know when your order is ready", { exact: false }).first().waitFor({ timeout: 8000 });
ok(true, "turning it on is confirmed");
ok((await p.evaluate(() => navigator.serviceWorker.getRegistration("/app/").then((r) => !!r))) === true, "the small background helper (service worker) is registered");

// the café marks it ready: the screen checks every few seconds, and the notification is shown once
square.set("PREPARED");
let notes = [];
for (let i = 0; i < 40 && !notes.length; i++) { await p.waitForTimeout(1000); notes = await p.evaluate(() => window.__notes); }
ok(notes.length === 1 && notes[0].title === "Your order is ready", "a notification is shown when the order is ready: " + JSON.stringify(notes[0] || null));
ok(/ready for pickup at Maruf Cafe/.test(notes[0]?.body || ""), "and it says where to pick it up");
await p.waitForTimeout(6000);
ok((await p.evaluate(() => window.__notes.length)) === 1, "it is not repeated while the order stays ready");

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
