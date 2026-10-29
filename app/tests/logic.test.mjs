// Run with: npm test   (plain Node, no phone or browser needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, parseTime, isPast, openStatus, greeting } from "../src/lib/dates.js";
import { buildQuote, buildEvent, QUOTE_THANKS, EVENT_THANKS, QUOTE_OPTIONAL, EVENT_OPTIONAL, hasHiddenError } from "../src/lib/forms.js";
import { plan, quantityFor } from "../src/lib/plan.js";
import { mergeSite, indexMenu, featuredItems } from "../src/lib/site-merge.js";
import { trimHistory } from "../src/lib/assistant-util.js";
import { shareText } from "../src/lib/share.js";
import { orderSummary, cleanNote, splitOrderable, buildPickup, orderBody, newKey, keyFor, stageInfo, ORDER_STAGES } from "../src/lib/order-util.js";
import { canPlaceCalls, parseContactLink, prettyPhone } from "../src/lib/links-util.js";
import { toggleFavorite, recordOrder, lastOrder, reorderIds, readSaved, readObject } from "../src/lib/memory-util.js";
import { controlsFor, isShown, applyChoice, cleanCustom, describeCustom, EMPTY } from "../src/lib/customize.js";

const NOW = new Date(2026, 9, 8, 12, 0);   // Thu Oct 8 2026, noon

test("dates are read the way people type them", () => {
  assert.equal(parseDate("12/20/2026", NOW), "2026-12-20");
  assert.equal(parseDate("1-5-27", NOW), "2027-01-05");
  assert.equal(parseDate("12/20", NOW), "2026-12-20");          // no year: this year
  assert.equal(parseDate("3/2", NOW), "2027-03-02");            // no year and already past: next year
  assert.equal(parseDate("2/30/2027", NOW), "");                // not a real date
  assert.equal(parseDate("tomorrow", NOW), "");
  assert.equal(isPast("2026-10-07", NOW), true);
  assert.equal(isPast("2026-10-08", NOW), false);               // today still counts
});

test("times accept 12-hour and 24-hour input", () => {
  assert.equal(parseTime("5:30 PM"), "17:30");
  assert.equal(parseTime("5pm"), "17:00");
  assert.equal(parseTime("12 am"), "00:00");
  assert.equal(parseTime("12:15pm"), "12:15");
  assert.equal(parseTime("17:30"), "17:30");
  assert.equal(parseTime("25:00"), "");
  assert.equal(parseTime("13pm"), "");
  assert.equal(parseTime("soon"), "");
});

const goodQuote = { fullName: "Sam Lee", phone: "(929) 555-0101", email: "sam@example.com", dateNeeded: "12/20/2026", fulfillment: "pickup", people: "40", pickupTime: "5:30 PM", foodItems: "6 trays", specialRequests: "", budget: "", notes: "", occasion: "Catering" };

test("a complete large-order form becomes the exact fields the server expects", () => {
  const { errors, fields } = buildQuote(goodQuote, NOW);
  assert.deepEqual(errors, {});
  assert.equal(fields.dateNeeded, "2026-12-20");
  assert.equal(fields.pickupTime, "17:30");
  assert.equal(fields.people, "40");
  assert.equal(fields.occasion, "Catering");
});

test("each missing or wrong large-order field is named", () => {
  const { errors } = buildQuote({ ...goodQuote, fullName: " ", email: "nope", dateNeeded: "10/01/2026", fulfillment: "", people: "0", pickupTime: "later", foodItems: "" }, NOW);
  assert.deepEqual(Object.keys(errors).sort(), ["dateNeeded", "email", "foodItems", "fulfillment", "fullName", "people", "pickupTime"]);
});

const goodEvent = { name: "Ana", phone: "9295550102", email: "ana@example.com", eventType: "Birthday Party", eventDate: "11/14/2026", startTime: "6 PM", endTime: "", guests: "30", needFood: "yes", catering: "", foodBudget: "", venueType: "full-venue", specialRequests: "", decorations: "", entertainment: "", notes: "", packageInterest: "Large Gathering" };

test("event form: required fields only are enough, optional ones stay optional", () => {
  const { errors, fields } = buildEvent({ ...goodEvent, startTime: "", needFood: "", venueType: "", packageInterest: "" }, NOW);
  assert.deepEqual(errors, {});
  assert.equal(fields.eventDate, "2026-11-14");
});
test("event form: problems are named per field", () => {
  const { errors } = buildEvent({ ...goodEvent, eventType: "", guests: "5000", phone: "12", startTime: "xx" }, NOW);
  assert.deepEqual(Object.keys(errors).sort(), ["eventType", "guests", "phone", "startTime"]);
});

test("the thank-you messages are the exact wording that was asked for", () => {
  assert.equal(QUOTE_THANKS, "Your request has been received. Maruf Cafe will contact you to discuss your order.");
  assert.equal(EVENT_THANKS, "Maruf Cafe has received your event request. Someone will contact you soon to discuss availability, pricing, food options, and your event.");
});

test("calculator never invents serving sizes or prices", () => {
  const cfg = { individual: { label: "Individual meals", perGuest: 1, price: null }, family: { label: "Family-style meals", serves: null, price: null }, trays: { label: "Catering trays", serves: 10, price: 60 } };
  assert.equal(plan("", {}, cfg).valid, false);
  assert.equal(plan("0", {}, cfg).valid, false);
  const p = plan("25", { individual: true, family: true }, cfg);
  assert.equal(p.n, 25);
  assert.equal(p.lines.find((l) => l.key === "individual").qty, 25);
  assert.equal(p.lines.find((l) => l.key === "family").qty, null);   // unknown serving size: no guess
  assert.equal(p.total, null);                                       // no prices: no total
  const t = plan("25", { trays: true }, cfg);
  assert.equal(t.lines[0].qty, 3);                                   // 25 guests / 10 per tray, rounded up
  assert.equal(t.total, 180);
  assert.equal(plan("25", { individual: true, trays: true }, cfg).total, null);   // one unpriced line: no partial total
  assert.equal(quantityFor({ perGuest: null, serves: null, price: null }, 10), null);
});

const HOURS = [{ label: "Mon – Sat", days: [1, 2, 3, 4, 5, 6], open: 7, close: 22 }, { label: "Sunday", days: [0], open: 7, close: 16 }];
test("open-now uses New York time and the right day's hours", () => {
  assert.equal(openStatus(HOURS, new Date("2026-10-08T17:00:00Z")).text, "Open now · until 10 PM");           // Thu 1 PM
  assert.equal(openStatus(HOURS, new Date("2026-10-08T09:00:00Z")).text, "Closed · opens 7 AM");              // Thu 5 AM
  assert.equal(openStatus(HOURS, new Date("2026-10-09T03:30:00Z")).text, "Closed · opens 7 AM tomorrow");     // Thu 11:30 PM
  assert.equal(openStatus(HOURS, new Date("2026-10-11T17:00:00Z")).text, "Open now · until 4 PM");            // Sunday 1 PM
  assert.equal(openStatus(HOURS, new Date("2026-10-11T21:30:00Z")).text, "Closed · opens 7 AM tomorrow");     // Sunday 5:30 PM
});

test("delivery needs an address, and the new quote fields are passed on", () => {
  const delivery = { ...goodQuote, fulfillment: "delivery", deliveryAddress: "", contactMethod: "text", dietary: "Nut allergy" };
  assert.deepEqual(Object.keys(buildQuote(delivery, NOW).errors), ["deliveryAddress"]);
  const ok = buildQuote({ ...delivery, deliveryAddress: " 12 Example St " }, NOW);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.fields.deliveryAddress, "12 Example St"); assert.equal(ok.fields.contactMethod, "text"); assert.equal(ok.fields.dietary, "Nut allergy");
  assert.equal(buildQuote({ ...goodQuote, deliveryAddress: "left over text" }, NOW).fields.deliveryAddress, "", "pickup never sends an address");
});

test("event form: backup date, budget and end-before-start", () => {
  assert.deepEqual(Object.keys(buildEvent({ ...goodEvent, endTime: "5 PM" }, NOW).errors), ["endTime"]);
  assert.deepEqual(Object.keys(buildEvent({ ...goodEvent, alternateDate: "10/01/2026" }, NOW).errors), ["alternateDate"]);
  const ok = buildEvent({ ...goodEvent, alternateDate: "11/21/2026", budget: "$2000", dietary: "Halal", contactMethod: "email" }, NOW);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.fields.alternateDate, "2026-11-21"); assert.equal(ok.fields.budget, "$2000");
});

const BASE = { business: { phone: "(929) 335-3296", phoneTel: "+19293353296", email: "", address: ["365 Veterans Rd W", "Staten Island, NY 10309"], hours: HOURS, instagram: "https://i/x", tiktok: "https://t/x" }, faq: [{ q: "a?", a: "b" }], packages: [{ id: "x", title: "X", blurb: "", includes: [] }], packagesNote: "note", venue: { capacity: "", notes: "", policies: "" }, gallery: [], reviews: [], photos: {}, menu: { groups: { Food: { Burgers: [{ id: "f-b", name: "Burger", cents: 1000 }] } } } };

test("live café details replace the built-in ones, and bad or missing answers change nothing", () => {
  assert.equal(mergeSite(BASE, null), BASE);
  assert.equal(mergeSite(BASE, "garbage"), BASE);
  const m = mergeSite(BASE, { business: { phone: "(718) 555-0100", phoneTel: "+17185550100", email: "hi@example.com", hours: [{ label: "Daily", days: [0, 1], open: 8.5, close: 20 }] }, venue: { capacity: "Up to 40 seated" }, faq: [], packagesNote: "" }, "https://cafe.example");
  assert.equal(m.business.phone, "(718) 555-0100"); assert.equal(m.business.email, "hi@example.com"); assert.equal(m.business.hours[0].open, 8.5);
  assert.deepEqual(m.business.address, BASE.business.address, "address not sent: keep ours");
  assert.deepEqual(m.faq, BASE.faq, "an empty FAQ from the server does not erase ours");
  assert.equal(m.packagesNote, "", "but the café can clear a note");
  assert.equal(m.venue.capacity, "Up to 40 seated"); assert.equal(m.venue.notes, "");
  assert.equal(mergeSite(BASE, { business: { hours: [{ label: "bad" }] } }).business.hours, HOURS, "malformed hours are ignored");
});

test("live photos, gallery and reviews are real entries only, with absolute photo addresses", () => {
  const m = mergeSite(BASE, { photos: { hero: "/uploads/a.jpg", bad: 5 }, gallery: [{ url: "/uploads/b.jpg", alt: "The counter" }, { url: "/uploads/c.jpg", alt: "" }], reviews: [{ name: "Jo", text: "Great" }, { name: "", text: "x" }] }, "https://cafe.example");
  assert.deepEqual(m.photos, { hero: "https://cafe.example/uploads/a.jpg" });
  assert.deepEqual(m.gallery.map((g) => g.url), ["https://cafe.example/uploads/b.jpg"], "a photo without a description is skipped");
  assert.equal(m.reviews.length, 1);
  assert.deepEqual(mergeSite(BASE, {}).reviews, [], "no reviews unless the café added some");
});

test("the live menu replaces the built-in one, and a removed item is simply gone", () => {
  const live = { groups: { Food: { Burgers: [{ id: "f-b", name: "Burger", cents: 1250 }] }, Drinks: { Coffee: [{ id: "d-l", name: "Latte", cents: 450 }] } } };
  const m = mergeSite(BASE, { menu: live });
  assert.equal(indexMenu(m.menu).get("f-b").cents, 1250);
  assert.equal(indexMenu(m.menu).get("d-l").cat, "Coffee");
  assert.equal(mergeSite(BASE, { menu: { groups: {} } }).menu, BASE.menu, "an empty menu from the server never wipes ours");
});

test("chat history sent to the assistant: recent turns only, errors left out, long text cut", () => {
  const msgs = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  assert.equal(trimHistory(msgs).length, 10);
  assert.equal(trimHistory(msgs).at(-1).content, "m13");
  assert.deepEqual(trimHistory([{ role: "user", content: "hi" }, { role: "assistant", content: "oops", error: true }]), [{ role: "user", content: "hi" }], "failed replies are not sent back");
  assert.equal(trimHistory([{ role: "user", content: "x".repeat(900) }])[0].content.length, 600);
  assert.deepEqual(Object.keys(trimHistory([{ role: "user", content: "a", extra: 1 }])[0]), ["role", "content"], "nothing but role and text leaves the phone");
});

test("direction links use the address text only, for Google Maps, Apple Maps and Waze", async () => {
  const { mapLinks } = await import("../src/lib/maps.js");
  const l = mapLinks(["365 Veterans Rd W", "Staten Island, NY 10309"]);
  const q = encodeURIComponent("365 Veterans Rd W, Staten Island, NY 10309");
  assert.equal(l.google, `https://www.google.com/maps/dir/?api=1&destination=${q}`);
  assert.equal(l.apple, `https://maps.apple.com/?daddr=${q}`);
  assert.equal(l.waze, `https://waze.com/ul?q=${q}&navigate=yes`);
  assert.doesNotMatch(JSON.stringify(l), /ll=|lat=|@\d/, "no made-up coordinates");
});

test("home picks: only items the café marked, never hidden ones, at most four, with a title the café can change", () => {
  const menu = { groups: { Drinks: { Coffee: [{ id: "a", name: "A", cents: 1, featured: true }, { id: "b", name: "B", cents: 1 }, { id: "c", name: "C", cents: 1, featured: true, hidden: true }] }, Food: { Burgers: [{ id: "d", name: "D", cents: 1, featured: true }, { id: "e", name: "E", cents: 1, featured: true }, { id: "f", name: "F", cents: 1, featured: true }, { id: "g", name: "G", cents: 1, featured: true }] } } };
  assert.deepEqual(featuredItems(menu).map((i) => i.id), ["a", "d", "e", "f"]);
  assert.deepEqual(featuredItems({ groups: { X: { Y: [{ id: "z", name: "Z", cents: 1 }] } } }), [], "nothing is shown as a pick unless the café picked it");
  assert.equal(mergeSite(BASE, { featuredTitle: "Most popular" }).featuredTitle, "Most popular");
  assert.equal(mergeSite(BASE, { featuredTitle: "" }).featuredTitle, BASE.featuredTitle ?? undefined);
});

test("the badge comes from the café's details; a blank one removes it and a missing one keeps the built-in", () => {
  assert.equal(mergeSite({ ...BASE, business: { ...BASE.business, badge: "100% Halal" } }, { business: { badge: "Halal chicken" } }).business.badge, "Halal chicken");
  assert.equal(mergeSite({ ...BASE, business: { ...BASE.business, badge: "100% Halal" } }, { business: { badge: "" } }).business.badge, "");
  assert.equal(mergeSite({ ...BASE, business: { ...BASE.business, badge: "100% Halal" } }, { business: {} }).business.badge, "100% Halal");
});

test("menu item pictures that point at the café's uploads become absolute; links and items without one are left alone", async () => {
  const { withImageUrls } = await import("../src/lib/site-merge.js");
  const menu = { currency: "USD", groups: { Drinks: { Coffee: [{ id: "a", name: "A", cents: 300, image: "/uploads/a.png" }, { id: "b", name: "B", cents: 400, image: "https://x.example/b.jpg" }, { id: "c", name: "C", cents: 500 }] } } };
  const out = withImageUrls(menu, "https://cafe.example").groups.Drinks.Coffee;
  assert.equal(out[0].image, "https://cafe.example/uploads/a.png"); assert.equal(out[1].image, "https://x.example/b.jpg"); assert.equal(out[2].image, undefined);
  assert.equal(menu.groups.Drinks.Coffee[0].image, "/uploads/a.png", "the original is not changed");
});

test("menu search: every word must match, names first, ignores case and accents, also finds by category", async () => {
  const { searchMenu } = await import("../src/lib/site-merge.js");
  const cats = [
    { name: "Coffee", items: [{ id: "1", name: "Latte", cents: 450 }, { id: "2", name: "Chai Latte", cents: 500 }, { id: "3", name: "Café Mocha", cents: 525, desc: "espresso and chocolate" }] },
    { name: "Sweets", items: [{ id: "4", name: "Brownie", cents: 300 }, { id: "5", name: "Latte Cake", cents: 600 }] },
  ];
  assert.deepEqual(searchMenu(cats, "latte").map((i) => i.id), ["1", "2", "5"]);
  assert.deepEqual(searchMenu(cats, "CAFE mocha").map((i) => i.id), ["3"], "accents and case do not matter");
  assert.deepEqual(searchMenu(cats, "chocolate").map((i) => i.id), ["3"], "descriptions count");
  assert.deepEqual(searchMenu(cats, "sweets").map((i) => i.id), ["4", "5"], "category names count");
  assert.deepEqual(searchMenu(cats, "chai cake"), [], "every word must match");
  assert.deepEqual(searchMenu(cats, "   "), []);
  assert.equal(searchMenu(cats, "brownie")[0]._cat, "Sweets");
});

test("built-in menu pictures: chosen by the item's name first, then its category; unknown kinds get none", async () => {
  const { artKey } = await import("../src/lib/menu-art-key.js");
  assert.equal(artKey({ name: "Americano", cat: "Coffee" }), "americano");
  assert.equal(artKey({ name: "Latte", cat: "Coffee" }), "coffee", "the plain latte keeps the latte-art picture");
  assert.equal(artKey({ name: "Maple Honey Almond Latte", cat: "Coffee" }), "icedlatte");
  assert.equal(artKey({ name: "Hazelnut Mocha", cat: "Coffee" }), "hazelnutmocha", "the specific mocha wins over the plain one");
  assert.equal(artKey({ name: "White Mocha", cat: "Coffee" }), "whitemocha");
  assert.equal(artKey({ name: "Chai Latte", cat: "Tea" }), "chai");
  assert.equal(artKey({ name: "Dirty Chai", cat: "Coffee" }), "dirtychai");
  assert.equal(artKey({ name: "Strawberry Acai", cat: "Refreshers" }), "refresher");
  assert.equal(artKey({ name: "Lemonade", cat: "Refreshers" }), "lemonade");
  assert.equal(artKey({ name: "Strawberry Banana Smoothie", cat: "Smoothies / Others" }), "smoothie");
  assert.equal(artKey({ name: "Hot Chocolate", cat: "Smoothies / Others" }), "hotchoc");
  assert.equal(artKey({ name: "Personal Pizza", cat: "Salads / Others" }), "pizza", "the name wins over the category");
  assert.equal(artKey({ name: "Garden Salad", cat: "Bowls" }), "bowl");
  assert.equal(artKey({ name: "Chicken Parmesan", cat: "Sandwiches" }), "sandwich");
  assert.equal(artKey({ name: "Chicken Tenders", cat: "Chicken & Wings" }), "chicken");
  assert.equal(artKey({ name: "Dubai Chocolate", cat: "Sweets" }), "sweets");
  assert.equal(artKey({ name: "A new coffee", cat: "Coffee" }), "coffee", "a drink added later falls back to its category");
  assert.equal(artKey({ name: "Mystery", cat: "Specials" }), null);
  assert.equal(artKey({}), null);
});

test("every drink on the menu has a picture, most kinds of drink have their own, and every picture file is registered", async () => {
  const { readFileSync } = await import("node:fs");
  const { artKey } = await import("../src/lib/menu-art-key.js");
  const menu = JSON.parse(readFileSync(new URL("../src/data/menu.json", import.meta.url), "utf8"));
  const art = readFileSync(new URL("../src/lib/menu-art.js", import.meta.url), "utf8");
  const registered = new Set([...art.matchAll(/(\w+): require\("\.\.\/\.\.\/assets\/menu\/(\w+)\.jpg"\)/g)].map((m) => { assert.equal(m[1], m[2]); return m[1]; }));
  const keys = [];
  for (const [cat, items] of Object.entries(menu.groups.Drinks)) for (const it of items) { const k = artKey({ name: it.name, cat }); assert.ok(k, `${it.name} has a picture`); assert.ok(registered.has(k), `${k} is registered`); keys.push(k); }
  assert.ok(new Set(keys).size >= 28, `only ${new Set(keys).size} different drink pictures for ${keys.length} drinks`);
  for (const [cat, items] of Object.entries({ ...menu.groups.Food })) for (const it of items) assert.ok(registered.has(artKey({ name: it.name, cat })), `${it.name} resolves to a registered picture`);
});


test("the share text only repeats what the café published, and skips what is blank", () => {
  const b = { name: "Maruf Cafe", address: ["365 Veterans Rd W", "Staten Island, NY 10309"], phone: "(929) 335-3296", orderUrl: "https://example.com/order" };
  assert.equal(shareText(b), "Maruf Cafe\n365 Veterans Rd W, Staten Island, NY 10309\n(929) 335-3296\nOrder: https://example.com/order");
  assert.equal(shareText({ name: "Maruf Cafe", address: [], phone: "", orderUrl: "" }), "Maruf Cafe");
  assert.equal(shareText({}), "Maruf Cafe");
});

test("the greeting follows the time in New York", () => {
  assert.equal(greeting(new Date("2026-10-08T12:00:00Z")), "Good morning");     // 8 AM in New York
  assert.equal(greeting(new Date("2026-10-08T18:00:00Z")), "Good afternoon");   // 2 PM
  assert.equal(greeting(new Date("2026-10-08T23:30:00Z")), "Good evening");     // 7:30 PM
});

test("the order summary lists each item once, with the customer's note in brackets", () => {
  const entries = [{ id: "a", name: "Americano", qty: 2 }, { id: "b", name: "Chai Latte", qty: 1 }];
  assert.equal(orderSummary(entries), "2 x Americano\n1 x Chai Latte");
  assert.equal(orderSummary(entries, { a: "  oat milk if you have it ", c: "ignored" }), "2 x Americano (oat milk if you have it)\n1 x Chai Latte");
  assert.equal(cleanNote("no\n  onions   please"), "no onions please");
  assert.equal(cleanNote("x".repeat(300)).length, 100);
});

test("favorites toggle on and off, newest first", () => {
  assert.deepEqual(toggleFavorite([], "a"), ["a"]);
  assert.deepEqual(toggleFavorite(["a"], "b"), ["b", "a"]);
  assert.deepEqual(toggleFavorite(["b", "a"], "b"), ["a"]);
});

test("recent orders: newest first, no duplicates, at most five, empty orders ignored", () => {
  let h = [];
  h = recordOrder(h, [{ id: "a", qty: 1 }]);
  h = recordOrder(h, []);
  assert.equal(h.length, 1);
  h = recordOrder(h, [{ id: "b", qty: 2 }, { id: "a", qty: 1 }]);
  h = recordOrder(h, [{ id: "a", qty: 1 }]);   // the same as the first: moves to the front, not listed twice
  assert.deepEqual(h, [[{ id: "a", qty: 1 }], [{ id: "b", qty: 2 }, { id: "a", qty: 1 }]]);
  for (let i = 0; i < 8; i++) h = recordOrder(h, [{ id: `x${i}`, qty: 1 }]);
  assert.equal(h.length, 5);
  assert.deepEqual(lastOrder(h), [{ id: "x7", qty: 1 }]);
  assert.deepEqual(lastOrder([]), []);
});

test("order again skips items the café has taken off the menu", () => {
  const menu = new Map([["a", {}], ["c", {}]]);
  assert.deepEqual(reorderIds([[{ id: "a", qty: 1 }, { id: "b", qty: 2 }, { id: "c", qty: 1 }]], menu), ["a", "c"]);
  assert.deepEqual(reorderIds([], menu), []);
});

test("saved data that is damaged is forgotten, not trusted", () => {
  assert.deepEqual(readSaved('["a","b"]', []), ["a", "b"]);
  assert.deepEqual(readSaved("{oops", []), []);
  assert.deepEqual(readSaved('{"a":1}', []), []);
  assert.deepEqual(readSaved(null, []), []);
});

test("drink controls: food has none, each kind of drink shows its own, size only when the price depends on it", () => {
  assert.deepEqual(controlsFor({ group: "Food", cat: "Burgers", cents: 1000 }), []);
  const ids = (it) => controlsFor(it).map((c) => c.id);
  assert.deepEqual(ids({ group: "Drinks", cat: "Coffee", cents: 300 }), ["temp", "shots", "syrup", "milk", "ice", "extras"]);
  assert.deepEqual(ids({ group: "Drinks", cat: "Coffee", min: 500, max: 600 }), ["size", "temp", "shots", "syrup", "milk", "ice", "extras"]);
  assert.deepEqual(ids({ group: "Drinks", cat: "Refreshers", min: 500, max: 650 }), ["size", "ice", "sweetness"]);
  assert.deepEqual(ids({ group: "Drinks", cat: "Tea", cents: 400 }), ["temp", "syrup", "milk", "ice"]);
  assert.deepEqual(ids({ group: "Drinks", cat: "Smoothies / Others", cents: 600 }), ["milk", "extras"]);
  assert.deepEqual(ids({ group: "Drinks", cat: "Brand new category", cents: 600 }), [], "an unknown drink category shows nothing, not a wrong set");
  assert.deepEqual(controlsFor({ group: "Drinks", cat: "Coffee", cents: 300 }, { temps: [], milks: [], flavors: [], ice: [], extras: [], maxShots: 0, maxPumps: 0 }), [], "a café that lists nothing shows nothing");
});

test("ice only follows an iced coffee or tea, and always shows for refreshers", () => {
  const coffee = controlsFor({ group: "Drinks", cat: "Coffee", cents: 300 }).find((c) => c.id === "ice");
  assert.equal(isShown(coffee, { temp: "Hot" }), false);
  assert.equal(isShown(coffee, { temp: "Iced" }), true);
  const refresher = controlsFor({ group: "Drinks", cat: "Refreshers", cents: 300 }).find((c) => c.id === "ice");
  assert.equal(isShown(refresher, {}), true);
});

test("a customized drink reads as one short line, in a fixed order", () => {
  const controls = controlsFor({ group: "Drinks", cat: "Coffee", min: 500, max: 600 });
  assert.equal(describeCustom({}, controls), "");
  const c = { milk: "Oat milk", temp: "Iced", size: "Large", shots: 2, pumps: 2, flavor: "Vanilla", ice: "Light ice", extras: ["Whipped cream"] };
  assert.equal(describeCustom(c, controls), "Large, Iced, 2 shots, 2 pumps Vanilla, Oat milk, Light ice, Whipped cream");
  assert.equal(describeCustom({ shots: 1, pumps: 1 }, controls), "1 shot, 1 pump of syrup");
  assert.equal(describeCustom({ ice: "Light ice", temp: "Hot" }, controls), "Hot", "ice is ignored on a hot drink");
});

test("choices that are not offered, or out of range, are dropped", () => {
  const controls = controlsFor({ group: "Drinks", cat: "Coffee", cents: 300 });
  const c = cleanCustom({ milk: "Unicorn milk", shots: 99, pumps: 99, flavor: "Vanilla", extras: ["Whipped cream", "Gold leaf"], size: "Large" }, controls);
  assert.equal(c.milk, "");
  assert.equal(c.shots, 4);
  assert.equal(c.pumps, 8);
  assert.deepEqual(c.extras, ["Whipped cream"]);
  assert.equal(c.size, "", "no size control on a single-price drink");
  assert.equal(cleanCustom({ shots: -3 }, controls).shots, 0);
});

test("choosing things in the app keeps the request consistent", () => {
  let c = applyChoice(EMPTY, { temp: "Iced" });
  c = applyChoice(c, { ice: "Light ice" });
  assert.equal(c.ice, "Light ice");
  c = applyChoice(c, { temp: "Hot" });
  assert.equal(c.ice, "", "going back to Hot drops the ice");
  c = applyChoice(c, { flavor: "Caramel" });
  assert.equal(c.pumps, 1, "a flavor asks for at least one pump");
  c = applyChoice(c, { pumps: 0 });
  assert.equal(c.flavor, "", "no pumps, no flavor");
});

test("phone and mail links are read so they can be shown on a computer with no dialer", () => {
  assert.deepEqual(parseContactLink("tel:+19293353296"), { kind: "phone", value: "+19293353296" });
  assert.deepEqual(parseContactLink("mailto:hello%40example.com?subject=Hi"), { kind: "email", value: "hello@example.com" });
  assert.equal(parseContactLink("https://example.com"), null);
  assert.equal(parseContactLink("tel:"), null);
  assert.equal(prettyPhone("+19293353296"), "(929) 335-3296");
  assert.equal(prettyPhone("9293353296"), "(929) 335-3296");
  assert.equal(prettyPhone("(929) 335-3296"), "(929) 335-3296");
  assert.equal(prettyPhone("12345"), "12345");
});

test("a mistake in a field tucked under More details is found, so that part can open", () => {
  const base = { fullName: "Sam Lee", phone: "(929) 555-0101", email: "sam@example.com", dateNeeded: "12/20/2099", fulfillment: "pickup", people: "20", foodItems: "trays", pickupTime: "soon", specialRequests: "", budget: "", notes: "", dietary: "", deliveryAddress: "", contactMethod: "" };
  const bad = buildQuote(base);
  assert.deepEqual(Object.keys(bad.errors), ["pickupTime"]);
  assert.equal(hasHiddenError(bad.errors, QUOTE_OPTIONAL), true);
  const required = buildQuote({ ...base, pickupTime: "", people: "" });
  assert.equal(hasHiddenError(required.errors, QUOTE_OPTIONAL), false, "a missing required field is always on screen");
  assert.equal(hasHiddenError({}, QUOTE_OPTIONAL), false);
  assert.equal(hasHiddenError({ startTime: "Enter a time like 6:00 PM." }, EVENT_OPTIONAL), true);
  assert.equal(hasHiddenError({ guests: "Enter how many guests (1 to 1000)." }, EVENT_OPTIONAL), false);
  // every field the form can complain about is either always shown or listed as tucked away
  const emptyEvent = { name: "", phone: "", email: "", eventType: "", eventDate: "x", startTime: "zz", endTime: "zz", alternateDate: "x", guests: "", needFood: "", catering: "", foodBudget: "", venueType: "", specialRequests: "", decorations: "", entertainment: "", notes: "", packageInterest: "", contactMethod: "", budget: "", dietary: "" };
  const eventErrors = Object.keys(buildEvent(emptyEvent).errors);
  const alwaysShown = ["name", "phone", "email", "eventType", "eventDate", "guests"];
  for (const k of eventErrors) assert.ok(alwaysShown.includes(k) || EVENT_OPTIONAL.includes(k), `${k} must be shown or listed`);
});

test("Call dials straight away on phones and tablets, and shows the number to copy only on computers", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  assert.equal(canPlaceCalls({ userAgent: iphone, platform: "iPhone", maxTouchPoints: 5, coarsePointer: true }), true, "an iPhone");
  assert.equal(canPlaceCalls({ userAgent: iphone }), true, "an iPhone even if the browser says nothing about its touch screen");
  assert.equal(canPlaceCalls({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36" }), true, "an Android phone");
  assert.equal(canPlaceCalls({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 }), true, "an iPad asking for the desktop site");
  assert.equal(canPlaceCalls({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 0 }), false, "a Mac");
  assert.equal(canPlaceCalls({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36", platform: "Win32", maxTouchPoints: 10, coarsePointer: false }), false, "a Windows laptop, even with a touch screen");
  assert.equal(canPlaceCalls({}), false, "nothing known");
  assert.equal(canPlaceCalls({ coarsePointer: true }), true, "a touch screen as the main pointer");
});

test("only items with one fixed price are sent from the app; sized ones are left to the counter", () => {
  const latte = { id: "latte", name: "Latte", cents: 450, qty: 1 }, lemonade = { id: "lemonade", name: "Lemonade", min: 400, max: 600, qty: 2 };
  const { ready, needsPrice } = splitOrderable([latte, lemonade]);
  assert.deepEqual(ready.map((l) => l.id), ["latte"]);
  assert.deepEqual(needsPrice.map((l) => l.id), ["lemonade"]);
  assert.deepEqual(splitOrderable([]), { ready: [], needsPrice: [] });
});

test("pickup details need a name and a 10-digit phone, and the phone is kept as digits", () => {
  const ok = buildPickup({ name: "  Sam   Lee ", phone: "(718) 555-0123", note: "  at 5  pm " });
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.fields, { name: "Sam Lee", phone: "7185550123", note: "at 5 pm" });
  assert.equal(buildPickup({ name: "Sam", phone: "1-718-555-0123", note: "" }).fields.phone, "7185550123");   // a leading 1 is dropped
  const bad = buildPickup({ name: " ", phone: "555-0123", note: "" });
  assert.ok(bad.errors.name && bad.errors.phone);
  assert.ok(buildPickup({ name: "x".repeat(61), phone: "7185550123" }).errors.name);
  assert.equal(buildPickup({ name: "Sam", phone: "7185550123", note: "y".repeat(400) }).fields.note.length, 200);
});

test("the order sent to the server holds ids, quantities and notes, never prices", () => {
  const entries = [{ id: "latte", name: "Latte", cents: 450, qty: 2 }, { id: "bagel", name: "Bagel", cents: 300, qty: 1 }];
  const body = orderBody(entries, { latte: "Iced, oat milk" }, { name: "Sam", phone: "7185550123", note: "" });
  assert.deepEqual(body, { items: [{ id: "latte", qty: 2, note: "Iced, oat milk" }, { id: "bagel", qty: 1 }], name: "Sam", phone: "7185550123" });
  assert.ok(!JSON.stringify(body).includes("450"));
  assert.equal(orderBody(entries, {}, { name: "Sam", phone: "7185550123", note: "ring the bell" }).note, "ring the bell");
});

test("the same order keeps one key, so pressing Place order twice can never order twice", () => {
  const k = newKey();
  assert.match(k, /^[0-9a-f]{32}$/);
  assert.notEqual(newKey(), newKey());
  let n = 0; const make = () => `key${++n}`;
  const a = { items: [{ id: "latte", qty: 1 }], name: "Sam", phone: "7185550123" };
  const first = keyFor(null, a, make);
  assert.equal(keyFor(first, { ...a }, make).key, first.key, "unchanged order: same key");
  assert.notEqual(keyFor(first, { ...a, name: "Pat" }, make).key, first.key, "a changed order: a new key");
});

test("each stage of an order says what is happening, and anything unknown reads as just sent", () => {
  assert.deepEqual(ORDER_STAGES.map((s) => s.id), ["received", "accepted", "ready"]);
  assert.deepEqual(["received", "accepted", "ready", "done", "canceled"].map((s) => stageInfo(s).step), [0, 1, 2, 2, -1]);
  assert.deepEqual(["received", "accepted", "ready", "done", "canceled"].map((s) => stageInfo(s).final), [false, false, false, true, true]);
  assert.equal(stageInfo("something new").status, "received");
  assert.match(stageInfo("received").text, /isn't confirmed until/);
});

test("the saved pickup name and phone are read back only if they are what was saved", () => {
  assert.deepEqual(readObject('{"name":"Sam","phone":"7185550123"}', null), { name: "Sam", phone: "7185550123" });
  assert.equal(readObject("[1,2]", null), null);
  assert.equal(readObject("not json", null), null);
  assert.equal(readObject(null, null), null);
});
