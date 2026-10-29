// Placing an order in the app: menu -> My order -> pickup details -> sent, then the café moves it along in (a stand-in for) Square.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-order.e2e.mjs
import http from "node:http";
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";

// A stand-in for Square: remembers the orders it is given and answers for them, with a fulfillment state the test can change.
const squareCalls = [], orders = new Map();
let fulfillment = "PROPOSED", failNext = 0;
const square = http.createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  const json = raw ? JSON.parse(raw) : {};
  squareCalls.push({ method: req.method, url: req.url, json });
  res.setHeader("Content-Type", "application/json");
  if (req.method === "POST" && req.url === "/v2/orders") {
    if (failNext > 0) { failNext--; res.statusCode = 500; return res.end(JSON.stringify({ errors: [{ code: "INTERNAL_SERVER_ERROR" }] })); }
    const sub = json.order.line_items.reduce((s, l) => s + l.base_price_money.amount * Number(l.quantity), 0);
    const order = { id: "SQORDER" + (orders.size + 1) + "ABCDEF", state: "OPEN", location_id: json.order.location_id, reference_id: json.order.reference_id, source: json.order.source, total_money: { amount: Math.round(sub * 1.08875), currency: "USD" }, fulfillments: [{ type: "PICKUP", state: "PROPOSED" }] };
    orders.set(order.id, order);
    return res.end(JSON.stringify({ order }));
  }
  const got = /^\/v2\/orders\/(\w+)$/.exec(req.url);
  if (req.method === "GET" && got && orders.has(got[1])) { const o = orders.get(got[1]); o.fulfillments[0].state = fulfillment; return res.end(JSON.stringify({ order: o })); }
  res.statusCode = 404; res.end(JSON.stringify({ errors: [{ code: "NOT_FOUND" }] }));
});
await new Promise((r) => square.listen(0, r));
square.unref();

const site = await startSite({ SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC", SQUARE_API_BASE: `http://localhost:${square.address().port}`, TAX_PERCENT: "8.875", ORDER_RATE_LIMIT_PER_MIN: "1000" });
const b = await chromium.launch({ executablePath: "" + (process.env.CHROMIUM || "/opt/pw-browsers/chromium") + "" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
// only what a person can see: the screens underneath a modal stay in the page
const seenOn = (page) => (text) => page.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const seen = seenOn(p);
const button = (name) => p.getByRole("button", { name, exact: true }).first();
const add = (item) => p.getByRole("button", { name: `Add ${item} to order`, exact: true }).first().click();

await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await add("Latte");
await p.getByRole("button", { name: "Add one more Latte" }).first().click();
await add("Bagel & Cream Cheese");

// an item with a price range cannot be sent from the app: the order says so and offers no Place order button
await add("Lemonade");
await p.getByRole("button", { name: /^View my order/ }).first().click();
await button("Clear my order").waitFor();
await p.waitForTimeout(600);
ok(await seen("Some items can't be sent from the app yet") && await seen("Lemonade"), "an item with more than one price is called out");
ok((await p.getByRole("button", { name: "Place order for pickup" }).count()) === 0, "no Place order button while that item is in the order");
await p.getByRole("button", { name: "Remove one Lemonade" }).first().click();
await p.waitForTimeout(300);

// the order with fixed prices can be placed
const place = p.getByRole("button", { name: "Place order for pickup" }).first();
await place.waitFor();
ok(await seen("You pay at the counter when you pick it up."), "My order says the customer pays at the counter");
await p.screenshot({ path: `${SHOTS}/order-1-my-order.png` });
await place.click();
await button("Place order").waitFor();
ok(await seen("3 items") === false && await seen("2 × Latte") && await seen("1 × Bagel & Cream Cheese"), "the pickup screen lists the items with quantities");
ok(await seen("Pick up at Maruf Cafe") && await seen("365 Veterans Rd W"), "the pickup screen shows where to pick it up");

// missing details are caught before anything is sent
await button("Place order").click();
await p.waitForTimeout(300);
ok(await seen("Enter a name for the order.") && await seen("Enter a 10-digit phone number"), "a name and a phone number are asked for");
ok(squareCalls.length === 0, "nothing reached Square yet");
const name = p.getByRole("textbox", { name: "Name", exact: true }), phone = p.getByRole("textbox", { name: "Phone Number", exact: true });
await name.fill("Sam Lee");
await phone.fill("(718) 555-0123");
await p.getByRole("textbox", { name: "Anything the café should know?" }).fill("I will be there at 5:30");
await p.screenshot({ path: `${SHOTS}/order-2-pickup.png` });

// the café's Square is down once: the order is not lost, the error is plain, and trying again does not order twice
failNext = 1;
await button("Place order").click();
await p.getByText("We couldn't send your order to the café").first().waitFor({ timeout: 10000 });
ok(true, "a failed send says so (and is not shown as sent)");
ok(await seen("2 × Latte"), "the order is still there after a failed send");
await button("Place order").click();
await p.getByText("Order code", { exact: false }).first().waitFor({ timeout: 10000 });
const posts = squareCalls.filter((c) => c.method === "POST");
ok(posts.length === 2 && posts[0].json.idempotency_key === posts[1].json.idempotency_key, "trying again reuses the same key, so Square can never make two orders");
const sent = posts[1].json;
const o = sent.order;
ok(o.line_items.length === 2 && o.line_items.some((l) => l.name === "Latte" && l.quantity === "2" && l.base_price_money.amount === 450), "Square got the items, quantities and the server's prices");
ok(o.fulfillments[0].type === "PICKUP" && o.fulfillments[0].pickup_details.recipient.display_name === "Sam Lee" && o.fulfillments[0].pickup_details.recipient.phone_number === "+17185550123", "Square got the pickup name and phone");
ok(o.fulfillments[0].pickup_details.note === "I will be there at 5:30", "the note for the café reached Square");
ok(o.source.name === "Maruf Cafe app" && /^[A-HJKMNP-Z2-9]{4}$/.test(o.reference_id), "the order is marked as coming from the app, with a short code");

// the confirmation
ok(await seen("Order sent") && await seen("Thank you, Sam Lee"), "the confirmation thanks the customer by name");
const code = (await p.getByLabel(/^Order code /).first().textContent()).trim();
ok(code === o.reference_id, `the customer sees the same code the café sees (${code})`);
ok(await seen("Pay at the counter when you pick it up."), "the confirmation repeats that payment is at the counter");
await p.screenshot({ path: `${SHOTS}/order-3-sent.png` });

// the café works on it in Square; the screen follows
fulfillment = "RESERVED";
await p.getByText("Maruf Cafe accepted your order").first().waitFor({ timeout: 12000 });
ok(true, "when the café accepts the order, the screen says so");
fulfillment = "PREPARED";
await p.getByText("Ready for pickup").first().waitFor({ timeout: 22000 });
ok(await seen("Come to the counter and pay there."), "when it is ready, the screen says so");
await p.screenshot({ path: `${SHOTS}/order-4-ready.png` });

// the order was cleared, and coming back after a reload still shows this order
await p.reload({ waitUntil: "load" });
await p.getByText("Ready for pickup").first().waitFor({ timeout: 22000 });
ok(true, "reloading the confirmation still shows the order and where it stands");

// next time the name and phone are already there
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await add("Latte");
await p.getByRole("button", { name: /^View my order/ }).first().click();
await p.getByRole("button", { name: "Place order for pickup" }).first().click();
await button("Place order").waitFor();
await p.waitForTimeout(500);
ok((await name.inputValue()) === "Sam Lee" && (await phone.inputValue()) === "(718) 555-0123", `the name and phone from last time are filled in (${await name.inputValue()} / ${await phone.inputValue()})`);

// Square is not connected: the app keeps the old ways to order
const off = await startSite({});
const p2 = await ctx.newPage();
await p2.goto(off.u + "/app/menu", { waitUntil: "load" });
await p2.getByRole("button", { name: "Add Latte to order", exact: true }).first().click();
await p2.getByRole("button", { name: /^View my order/ }).first().click();
await p2.getByRole("button", { name: "Request a quote with these items" }).first().waitFor();
await p2.waitForTimeout(500);
ok((await p2.getByRole("button", { name: "Place order for pickup" }).count()) === 0 && await p2.getByRole("link", { name: "Order pickup on Square Online" }).filter({ visible: true }).first().isVisible(), "without Square connected there is no Place order button, only the quote and Square Online");
off.close();

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
