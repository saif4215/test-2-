// Paying in the app: the card form (Square's, faked here), Apple Pay, a declined card, and what reaches Square. Square's browser script is replaced by a small stand-in.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-pay.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
import { startSquare } from "./square-standin.mjs";

const square = await startSquare();
square.loyalty(false);
const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_APPLICATION_ID: "sandbox-sq0idb-TESTAPP", SQUARE_API_BASE: square.url, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const FAKE_SQUARE = `
window.Square = { payments: function (appId, locationId) {
  window.__sq = { appId: appId, locationId: locationId };
  return {
    card: async function () { return {
      attach: async function (sel) { document.querySelector(sel).innerHTML = '<input id="fake-card" aria-label="Fake card number" placeholder="Card number" style="width:100%;height:44px">'; },
      tokenize: async function () { var v = document.getElementById("fake-card").value; return { status: "OK", token: v || "cnon:card-nonce-ok" }; },
      destroy: function () {} }; },
    paymentRequest: function (r) { window.__req = r; return r; },
    applePay: async function () { if (!window.__applePayOk) throw new Error("not here"); return { tokenize: async function () { return { status: "OK", token: "wallet:applepay-ok-1234" }; } }; },
    googlePay: async function () { throw new Error("not here"); }
  }; } };`;
async function phone(extraInit) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("maruf:menu-layout", "list"); sessionStorage.setItem("maruf:opened", "1"); } catch { /* no storage */ } });
  if (extraInit) await ctx.addInitScript(extraInit);
  await ctx.route("https://sandbox.web.squarecdn.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_SQUARE }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  return p;
}
const lemonade = async (p) => {
  await p.goto(site.u + "/app/menu", { waitUntil: "load" });
  await p.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
  await p.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().click();
};
const seenOn = (p) => (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);

// ── the card form ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const p = await phone();
const seen = seenOn(p);
await lemonade(p);
await p.getByText("Pay now", { exact: true }).first().waitFor({ timeout: 10000 });
ok(await p.getByRole("button", { name: "Place order for pickup", exact: true }).count() === 0, "there is no 'place order, pay at the counter' button once online payment is on");
ok(await seen("You pay now, here in the app"), "the pickup card says there is nothing to pay at the counter");
await p.locator("#fake-card").waitFor({ timeout: 8000 });
ok((await p.evaluate(() => window.__sq)).appId === "sandbox-sq0idb-TESTAPP", "Square's form is started with the café's application ID");
const payBtn = () => p.getByRole("button", { name: /^Pay \$/ }).filter({ visible: true }).first();
ok((await payBtn().getAttribute("aria-label")) === "Pay $3.81 and place the order", "the button shows the total with tax: $3.50 + 8.875% = $3.81");
await p.getByRole("button", { name: "20% · $0.70", exact: true }).click();
ok((await payBtn().getAttribute("aria-label")) === "Pay $4.51 and place the order" && await seen("Total to pay"), "a tip is added to what they pay: $4.51");
ok(await seen("Your tip is added to your payment"), "and the tip text says so");
await p.screenshot({ path: `${SHOTS}/pay-1-form.png` });

// checks happen before any card is read or charged
await payBtn().click();
await p.getByText("Enter a name for the order.", { exact: false }).first().waitFor({ timeout: 5000 });
ok(!!(await p.evaluate(() => true)) && Object.keys(square.payments).length === 0 && square.payments.size === 0 && !square.calls.some((c) => c.url === "/v2/orders"), "a missing name stops everything: no order, no charge");

// a declined card
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550123");
await p.locator("#fake-card").fill("cnon:card-nonce-declined");
await payBtn().click();
await p.getByText("Your card was declined", { exact: false }).first().waitFor({ timeout: 10000 });
ok(true, "a declined card is explained in plain words and they stay on the order screen");
ok([...square.orders.values()].every((o) => o.state === "CANCELED") && square.payments.size === 0, "the unpaid order was canceled at Square, nothing was charged");
await p.screenshot({ path: `${SHOTS}/pay-2-declined.png` });

// a good card
await p.locator("#fake-card").fill("cnon:card-nonce-ok");
await payBtn().click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 15000 });
ok(await seen("You paid in the app"), "after paying, the order screen says there is nothing to pay at the counter");
const pay = [...square.payments.values()][0].request;
ok(pay.amount_money.amount === 381 && pay.tip_money && pay.tip_money.amount === 70, "Square was charged $3.81 and a $0.70 tip");
ok([...square.orders.values()].filter((o) => o.state === "OPEN").length === 1 && square.payments.size === 1, "one open, paid order, and one payment");
await p.screenshot({ path: `${SHOTS}/pay-3-paid.png` });

// ── Apple Pay, on a device that has it ─────────────────────────────────────────────────────────────────────────────────────────────
const a = await phone(() => { window.__applePayOk = true; });
await lemonade(a);
await a.getByRole("button", { name: "Pay with Apple Pay" }).waitFor({ timeout: 10000 });
ok(true, "where Apple Pay is available its button is shown above the card form");
ok(await seenOn(a)("or pay with a card"), "with 'or pay with a card' under it");
await a.getByRole("textbox", { name: "Name", exact: true }).fill("Ann Wu");
await a.getByRole("textbox", { name: "Phone Number", exact: true }).fill("7185550199");
await a.getByRole("button", { name: "Pay with Apple Pay" }).click();
await a.getByText("Order code", { exact: false }).first().waitFor({ timeout: 15000 });
const wallets = [...square.payments.values()].filter((x) => x.source_id === "wallet:applepay-ok-1234");
ok(wallets.length === 1 && wallets[0].request.amount_money.amount === 381, "an Apple Pay payment goes through the same server charge");
await a.screenshot({ path: `${SHOTS}/pay-4-applepay.png` });

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
