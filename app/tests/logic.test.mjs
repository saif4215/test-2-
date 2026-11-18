// Run with: npm test   (plain Node, no phone or browser needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, parseTime, isPast, openStatus, greeting, closedNotice } from "../src/lib/dates.js";
import { buildQuote, buildEvent, QUOTE_THANKS, EVENT_THANKS, QUOTE_OPTIONAL, EVENT_OPTIONAL, hasHiddenError } from "../src/lib/forms.js";
import { plan, quantityFor } from "../src/lib/plan.js";
import { mergeSite, indexMenu, featuredItems, suggestFor, dietsPresent, filterByDiet, newItems, itemFacts, pickedForYou } from "../src/lib/site-merge.js";
import { trimHistory, readProposal, proposalTotal, mergeNote } from "../src/lib/assistant-util.js";
import { shareText } from "../src/lib/share.js";
import { orderSummary, cleanNote, splitOrderable, buildPickup, orderBody, newKey, keyFor, stageInfo, ORDER_STAGES, estimateTax, pausedMs, readTiers, readLookup, tipAmount, TIP_PERCENTS, notificationFor, readPayments } from "../src/lib/order-util.js";
import { cleanPref, DEFAULTS } from "../src/lib/prefs-util.js";
import { canPlaceCalls, parseContactLink, prettyPhone } from "../src/lib/links-util.js";
import { toggleFavorite, rewardProgress, spendPoints, recordOrder, lastOrder, reorderIds, readSaved, readObject, readCart, cartToSave, readCustom, readActive, MAX_QTY, ACTIVE_HOURS, addUsual, removeUsual, readUsuals, recordHistory, readHistory, MAX_USUALS, MAX_HISTORY, readPoints, awardPoints, activePromotions, readSearches, addSearch } from "../src/lib/memory-util.js";
import { hasOffers, resolve, unitCents, extrasCents, togglePick, setSize, describeCustom, orderChoice, missingRequired, needsChoice } from "../src/lib/customize.js";

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

// ── sizes and priced choices ("make it your way") ─────────────────────────────────────────────────────────────────────────────
const SETS = {
  temp: { id: "temp", label: "Hot or iced", kind: "one", choices: [{ name: "Hot", cents: 0 }, { name: "Iced", cents: 0 }] },
  milk: { id: "milk", label: "Alternative milk", kind: "one", choices: [{ name: "Oat milk", cents: 100 }, { name: "Almond milk", cents: 100 }] },
  syrup: { id: "syrup", label: "Syrup", kind: "many", max: 2, choices: [{ name: "Vanilla", cents: 50 }, { name: "Caramel", cents: 50 }, { name: "Hazelnut", cents: 50 }] },
  heat: { id: "heat", label: "Hot or regular", kind: "one", required: true, choices: [{ name: "Regular", cents: 0 }, { name: "Hot", cents: 0 }] },
};
const LATTE = { id: "latte", name: "Latte", cents: 450, sizes: [{ name: "Small", cents: 450 }, { name: "Large", cents: 550 }], optionSets: [SETS.temp, SETS.milk, SETS.syrup] };
const TENDERS = { id: "tenders", name: "2pc Tenders", cents: 600, optionSets: [SETS.heat] };
const BAGEL = { id: "bagel", name: "Bagel", cents: 300 };

test("an item with nothing to choose offers nothing; sizes and choices come from the menu", () => {
  assert.equal(hasOffers(BAGEL), false);
  assert.equal(hasOffers(LATTE), true);
  assert.equal(hasOffers(TENDERS), true, "a must-pick choice is something to choose");
  assert.equal(hasOffers({ cents: 300, sizes: [{ name: "Small", cents: 300 }] }), false, "one size is no choice");
});

test("nothing picked means the first size at the menu price, and a must-pick choice is never filled in for the customer", () => {
  assert.deepEqual(resolve(LATTE, undefined), { size: "Small", picks: {} });
  assert.deepEqual(resolve(TENDERS, undefined), { size: "", picks: {} });
  assert.deepEqual(missingRequired(TENDERS, undefined), [{ id: "heat", label: "Hot or regular" }]);
  assert.deepEqual(missingRequired(TENDERS, { picks: { heat: ["Hot"] } }), []);
  assert.deepEqual(missingRequired(LATTE, undefined), [], "optional choices are never missing");
  assert.equal(needsChoice({ options: ["milk", "heat"] }, { milk: SETS.milk, heat: SETS.heat }), true);
  assert.equal(needsChoice({ options: ["milk"] }, { milk: SETS.milk }), false);
  assert.equal(needsChoice({ id: "bagel" }, {}), false);
  assert.equal(unitCents(LATTE, undefined), 450);
  assert.equal(unitCents(BAGEL, undefined), 300);
});

test("the price is the size plus what each choice adds", () => {
  assert.equal(unitCents(LATTE, { size: "Large" }), 550);
  assert.equal(unitCents(LATTE, { size: "Large", picks: { milk: ["Oat milk"] } }), 650);
  assert.equal(unitCents(LATTE, { size: "Small", picks: { milk: ["Oat milk"], syrup: ["Vanilla", "Caramel"], temp: ["Iced"] } }), 450 + 100 + 100);
  assert.equal(extrasCents(LATTE, { size: "Large", picks: { milk: ["Oat milk"] } }), 100);
  assert.equal(unitCents({ min: 300, max: 400 }, {}), null, "an item with only a price range has no single price");
});

test("a choice the menu does not offer is ignored, never charged", () => {
  const c = { size: "Jumbo", picks: { milk: ["Unicorn milk"], syrup: ["Vanilla", "Caramel", "Hazelnut"], ghost: ["x"], temp: ["Hot", "Iced"] } };
  const r = resolve(LATTE, c);
  assert.equal(r.size, "Small");
  assert.equal(r.picks.milk, undefined);
  assert.deepEqual(r.picks.syrup, ["Vanilla", "Caramel"], "only as many as the set allows");
  assert.deepEqual(r.picks.temp, ["Hot"], "a choose-one set keeps one");
  assert.equal(r.picks.ghost, undefined);
  assert.equal(resolve(LATTE, "junk").size, "Small");
  assert.equal(resolve(LATTE, { picks: { milk: "Oat milk" } }).picks.milk, undefined, "wrong shapes are ignored");
});

test("tapping choices: one replaces one, tapping it again clears it, must-picks stay, any-sets toggle up to their limit", () => {
  let c = togglePick(LATTE, undefined, "milk", "Oat milk");
  assert.deepEqual(resolve(LATTE, c).picks.milk, ["Oat milk"]);
  c = togglePick(LATTE, c, "milk", "Almond milk");
  assert.deepEqual(resolve(LATTE, c).picks.milk, ["Almond milk"]);
  c = togglePick(LATTE, c, "milk", "Almond milk");
  assert.equal(resolve(LATTE, c).picks.milk, undefined);
  let t = togglePick(TENDERS, undefined, "heat", "Hot");
  assert.deepEqual(resolve(TENDERS, t).picks.heat, ["Hot"]);
  t = togglePick(TENDERS, t, "heat", "Hot");
  assert.equal(resolve(TENDERS, t).picks.heat, undefined, "tapping it again clears it, and the order then asks again");
  assert.equal(missingRequired(TENDERS, t).length, 1);
  c = togglePick(LATTE, c, "syrup", "Vanilla"); c = togglePick(LATTE, c, "syrup", "Caramel"); c = togglePick(LATTE, c, "syrup", "Hazelnut");
  assert.deepEqual(resolve(LATTE, c).picks.syrup, ["Vanilla", "Caramel"], "a third syrup is not added");
  c = togglePick(LATTE, c, "syrup", "Vanilla");
  assert.deepEqual(resolve(LATTE, c).picks.syrup, ["Caramel"]);
  assert.equal(togglePick(LATTE, c, "nope", "x"), c);
  assert.equal(setSize(c, "Large").size, "Large");
});

test("what the customer asked for reads as one short line, in the menu's order", () => {
  assert.equal(describeCustom(LATTE, undefined), "Small");
  assert.equal(describeCustom(LATTE, { size: "Large", picks: { syrup: ["Caramel"], temp: ["Iced"], milk: ["Oat milk"] } }), "Large, Iced, Oat milk, Caramel");
  assert.equal(describeCustom(TENDERS, undefined), "");
  assert.equal(describeCustom(TENDERS, { picks: { heat: ["Hot"] } }), "Hot");
  assert.equal(describeCustom(BAGEL, undefined), "");
});

test("the order carries the size and choices, not prices", () => {
  assert.deepEqual(orderChoice(LATTE, undefined), { size: "Small" });
  assert.deepEqual(orderChoice(LATTE, { size: "Large", picks: { milk: ["Oat milk"] } }), { size: "Large", picks: { milk: ["Oat milk"] } });
  assert.deepEqual(orderChoice(BAGEL, undefined), {});
});

test("the app and the server work out the same price for every item on the real menu, with and without choices", async () => {
  const { readFileSync } = await import("node:fs");
  const { priceChoice } = await import("../../lib/options.mjs");
  const { checkoutIndex } = await import("../../lib/menu.mjs");
  const menu = JSON.parse(readFileSync(new URL("../src/data/menu.json", import.meta.url), "utf8"));
  const served = JSON.parse(readFileSync(new URL("../../public/menu.json", import.meta.url), "utf8"));
  assert.deepEqual(menu, served, "the app's built-in menu is a copy of the live one");
  const index = checkoutIndex(menu), items = indexMenu(menu);
  assert.ok(items.size > 60);
  for (const [id, item] of items) {
    const entry = index.get(id);
    assert.ok(entry, `${item.name} can be ordered in the app`);
    const lastSize = item.sizes ? item.sizes[item.sizes.length - 1].name : undefined;
    const picks = {};
    for (const set of item.optionSets || []) picks[set.id] = set.kind === "many" ? set.choices.slice(0, set.max || set.choices.length).map((c) => c.name) : [set.choices[set.choices.length - 1].name];
    const must = {};   // a must-pick choice has no default, so even the plainest order picks the first one
    for (const set of item.optionSets || []) if (set.required) must[set.id] = [set.choices[0].name];
    for (const custom of [{ picks: must }, { size: lastSize, picks }]) {
      const mine = unitCents(item, custom), theirs = priceChoice(entry, orderChoice(item, custom));
      assert.equal(mine, theirs.cents, `${item.name}: the price agrees`);
    }
  }
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

test("the order sent to the server holds ids, quantities, choices and notes, never prices", () => {
  const entries = [{ id: "latte", name: "Latte", cents: 450, unit: 650, qty: 2, choice: { size: "Large", picks: { milk: ["Oat milk"] } } }, { id: "bagel", name: "Bagel", cents: 300, unit: 300, qty: 1, choice: {} }];
  const body = orderBody(entries, { latte: "extra hot" }, { name: "Sam", phone: "7185550123", note: "" });
  assert.deepEqual(body, { items: [{ id: "latte", qty: 2, size: "Large", picks: { milk: ["Oat milk"] }, note: "extra hot" }, { id: "bagel", qty: 1 }], name: "Sam", phone: "7185550123" });
  assert.ok(!JSON.stringify(body).includes("650") && !JSON.stringify(body).includes("450"));
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

// ── the order kept on the phone ─────────────────────────────────────────────────────────────────────────────────────────────────
test("a saved order comes back as it was, and only the items in the order are saved", () => {
  const cart = { lines: { latte: 2, bagel: 1 }, notes: { latte: "extra hot", ghost: "x" }, custom: { latte: { size: "Large", picks: { milk: ["Oat milk"] } }, ghost: { size: "Small", picks: {} } } };
  const saved = cartToSave(cart);
  assert.deepEqual(Object.keys(saved.notes), ["latte"]);
  assert.deepEqual(Object.keys(saved.custom), ["latte"]);
  const back = readCart(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.lines, { latte: 2, bagel: 1 });
  assert.equal(back.notes.latte, "extra hot");
  assert.deepEqual(back.custom.latte, { size: "Large", picks: { milk: ["Oat milk"] } });
});
test("a damaged saved order is cleaned, never trusted", () => {
  assert.deepEqual(readCart(null), { lines: {}, notes: {}, custom: {} });
  assert.deepEqual(readCart("nope"), { lines: {}, notes: {}, custom: {} });
  assert.deepEqual(readCart({ lines: [1, 2] }).lines, {});
  const odd = readCart({ lines: { a: 0, b: -3, c: "x", d: 2.9, e: 999 }, notes: { d: 12345 }, custom: { d: { picks: 5, size: { x: 1 }, temp: "Iced" }, e: [1] } });
  assert.deepEqual(odd.lines, { d: 2, e: MAX_QTY });   // zero, negative and non-numbers dropped; too many capped at what the café's server takes
  assert.equal(odd.notes.d, undefined);
  assert.deepEqual(odd.custom.d, { size: "", picks: {} });
  assert.deepEqual(readCustom({ size: "Large", picks: { milk: ["Oat milk", 5], bad: "x" }, shots: 3 }), { size: "Large", picks: { milk: ["Oat milk"] } }, "an older saved order's other fields are dropped");
  assert.equal(odd.custom.e, undefined);
  assert.equal(readCustom([1]), null);
  const many = readCart({ lines: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`i${i}`, 1])) });
  assert.equal(Object.keys(many.lines).length, 40);
});
test("the order just placed is shown for 12 hours, then forgotten", () => {
  const now = 1_700_000_000_000, order = { id: "SQORDER1ABCDEF", ref: "ZVF7", name: "Sam", total: 818, at: now - 60_000 };
  assert.deepEqual(readActive(order, now), { id: "SQORDER1ABCDEF", ref: "ZVF7", name: "Sam", total: 818, at: now - 60_000, preview: false });
  assert.equal(readActive({ ...order, at: now - (ACTIVE_HOURS * 3600_000 + 1) }, now), null);
  assert.equal(readActive({ ...order, at: now + 2 * 3600_000 }, now), null);
  assert.equal(readActive({ ...order, id: "bad id!" }, now), null);
  assert.equal(readActive({ ...order, id: undefined }, now), null);
  assert.equal(readActive(null, now), null);
  assert.equal(readActive({ ...order, total: "" }, now).total, null);
  assert.equal(readActive({ ...order, preview: true }, now).preview, true);
});

// ── "Add something else" ───────────────────────────────────────────────────────────────────────────────────────────────────────
const shop = { groups: {
  Drinks: { Coffee: [{ id: "d1", name: "Latte", cents: 450 }, { id: "d2", name: "Mocha", cents: 500, featured: true }], Tea: [{ id: "d3", name: "Chai", cents: 450 }] },
  Food: { Bagels: [{ id: "f1", name: "Bagel", cents: 300 }, { id: "f2", name: "Hidden", cents: 100, hidden: true }], Sweets: [{ id: "f3", name: "Cake", cents: 600 }], Sides: [{ id: "f4", name: "Fries", cents: 400 }] },
} };
test("a drink is offered food first, one from each category, and never itself, hidden items or what is already ordered", () => {
  const latte = { id: "d1", group: "Drinks", cat: "Coffee" };
  assert.deepEqual(suggestFor(shop, latte).map((i) => i.id), ["f1", "f3", "f4", "d3"]);   // food first, then another kind of drink (not more of the same category)
  assert.deepEqual(suggestFor(shop, latte, ["f1"]).map((i) => i.id), ["f3", "f4", "d3"]);
  assert.deepEqual(suggestFor(shop, latte, [], 2).map((i) => i.id), ["f1", "f3"]);
  assert.ok(!suggestFor(shop, latte).some((i) => i.hidden || i.id === "d1"));
});
test("food is offered drinks first, and the café's picks lead their category", () => {
  const bagel = { id: "f1", group: "Food", cat: "Bagels" };
  assert.deepEqual(suggestFor(shop, bagel).map((i) => i.id), ["d2", "d3", "d1", "f3", "f4"]);   // one from each drink category in turn, the picked Mocha first
  assert.deepEqual(suggestFor({ groups: { Food: { A: [{ id: "x", name: "X", cents: 1 }] } } }, { id: "x", group: "Food", cat: "A" }), []);
});

test("tax is shown as an estimate of the café's percentage", () => {
  assert.equal(estimateTax(1000, 8.875), 89);
  assert.equal(estimateTax(1000, 0), 0);
  assert.equal(estimateTax(0, 8.875), 0);
  assert.equal(estimateTax(450, 8.875), 40);
});

test("while the café is closed an order is warned about it, and nothing is said while it is open", () => {
  const hours = [{ label: "Mon – Sat", days: [1, 2, 3, 4, 5, 6], open: 7, close: 22 }, { label: "Sunday", days: [0], open: 7, close: 16 }];
  const at = (iso) => new Date(iso);   // New York is UTC-5 in January
  assert.equal(closedNotice(hours, at("2026-01-12T17:00:00Z")), null);   // Monday 12:00
  const early = closedNotice(hours, at("2026-01-12T10:00:00Z"));          // Monday 5:00
  assert.equal(early.title, "Maruf Cafe is closed right now");
  assert.match(early.text, /opens 7 AM\./);
  assert.match(early.text, /may not see your order/);
  const late = closedNotice(hours, at("2026-01-13T04:00:00Z"));           // Monday 23:00
  assert.match(late.text, /opens 7 AM tomorrow/);
  assert.equal(closedNotice([], at("2026-01-13T04:00:00Z")).text, "The café may not see your order until it opens.");
});

// ── what the assistant puts together ─────────────────────────────────────────────────────────────────────────────────────────────
test("a proposal from the assistant is checked against this phone's menu, and prices come only from the menu", () => {
  const byId = new Map([["latte", { id: "latte", name: "Latte", cents: 450 }], ["lem", { id: "lem", name: "Lemonade", min: 400, max: 600 }], ["gone", { id: "gone", name: "Gone", cents: 100, hidden: true }]]);
  const lines = readProposal([{ id: "latte", qty: 2, note: " iced \n oat ", cents: 1 }, { id: "latte", qty: 1 }, { id: "nope", qty: 1 }, { id: "gone", qty: 1 }, { id: "lem", qty: 99 }, { id: "lem", qty: 0 }, null, { id: "latte", qty: "x" }], byId);
  assert.deepEqual(lines.map((l) => [l.id, l.qty, l.note]), [["latte", 2, "iced oat"], ["lem", 20, ""]]);
  assert.equal(lines[0].item.cents, 450, "the price is the menu's");
  assert.deepEqual(readProposal("latte", byId), []);
  assert.deepEqual(readProposal(undefined, byId), []);
  assert.equal(readProposal(Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, qty: 1 })), new Map(Array.from({ length: 30 }, (_, i) => [`i${i}`, { id: `i${i}`, name: "x", cents: 1 }]))).length, 10);
  assert.deepEqual(proposalTotal(lines.slice(0, 1)), { low: 900, high: 900, exact: true });
  assert.deepEqual(proposalTotal(lines), { low: 900 + 8000, high: 900 + 12000, exact: false });
});
test("the assistant's request is added to a note the customer already wrote, not over it", () => {
  assert.equal(mergeNote("", "iced"), "iced");
  assert.equal(mergeNote("no ice", "oat milk"), "no ice; oat milk");
  assert.equal(mergeNote("Iced, oat milk", "iced"), "Iced, oat milk");
  assert.equal(mergeNote("x", ""), "x");
  assert.equal(mergeNote("a".repeat(95), "bbbbbbbb").length, 100);
});

test("close to closing time the café says how many minutes are left", () => {
  const hours = [{ label: "Mon – Sat", days: [1, 2, 3, 4, 5, 6], open: 7, close: 22 }];
  const at = (iso) => new Date(iso);   // New York is UTC-5 in January
  const soon = openStatus(hours, at("2026-01-13T02:30:00Z"));   // Monday 9:30 PM
  assert.equal(soon.open, true); assert.equal(soon.closesSoon, true); assert.equal(soon.text, "Open now · closes in 30 min");
  const later = openStatus(hours, at("2026-01-12T20:00:00Z"));   // Monday 3 PM
  assert.equal(later.closesSoon, false); assert.equal(later.text, "Open now · until 10 PM");
  assert.equal(openStatus(hours, at("2026-01-13T02:15:00Z")).closesSoon, true, "45 minutes left still counts");
  assert.equal(openStatus(hours, at("2026-01-13T02:14:00Z")).closesSoon, false, "46 minutes left does not");
});

// ── My usual drinks and past orders ─────────────────────────────────────────────────────────────────────────────────────────────
test("a usual is saved with its choices, newest first, once, and can be removed", () => {
  const big = { size: "Large", picks: { milk: ["Oat milk"], temp: ["Iced"] } };
  let list = addUsual([], { itemId: "latte", name: "Latte · Large, Iced, Oat milk", choice: big }, () => "a");
  list = addUsual(list, { itemId: "latte", name: "Latte", choice: { size: "Small", picks: { temp: ["Hot"] } } }, () => "b");
  assert.deepEqual(list.map((u) => u.id), ["b", "a"]);
  list = addUsual(list, { itemId: "latte", name: "Latte · Large, Iced, Oat milk", choice: big }, () => "c");
  assert.deepEqual(list.map((u) => u.id), ["c", "b"], "the same drink made the same way moves to the front instead of being listed twice");
  assert.deepEqual(removeUsual(list, "b").map((u) => u.id), ["c"]);
  assert.deepEqual(addUsual(list, { itemId: "", name: "x" }), list, "nothing to save without an item");
  let many = [];
  for (let i = 0; i < 30; i++) many = addUsual(many, { itemId: `i${i}`, name: "x", choice: {} });
  assert.equal(many.length, MAX_USUALS);
});

test("saved usuals are read back only if they look right", () => {
  assert.deepEqual(readUsuals("nope"), []);
  const back = readUsuals([{ id: "a", itemId: "latte", name: "Mine", choice: { size: "Large", picks: { milk: ["Oat milk", 5], bad: "x" }, shots: 3 } }, { id: 5, itemId: "x" }, null, { id: "b" }]);
  assert.deepEqual(back, [{ id: "a", itemId: "latte", name: "Mine", choice: { size: "Large", picks: { milk: ["Oat milk"] } } }]);
});

test("past orders keep what was ordered, with choices, newest first, at most 20; empty orders and damaged saves are ignored", () => {
  let h = recordHistory([], [{ id: "latte", qty: 2, choice: { size: "Large" } }, { id: "bagel", qty: 1, choice: {} }, { id: "x", qty: 0 }], { at: 1000, subtotal: 1900 });
  assert.deepEqual(h, [{ at: 1000, subtotal: 1900, lines: [{ id: "latte", qty: 2, choice: { size: "Large" } }, { id: "bagel", qty: 1 }] }]);
  h = recordHistory(h, [{ id: "tea", qty: 1 }], { at: 2000 });
  assert.deepEqual(h.map((o) => o.at), [2000, 1000]);
  assert.equal(h[0].subtotal, null);
  assert.equal(recordHistory(h, [], { at: 3 }), h);
  let many = [];
  for (let i = 1; i <= 30; i++) many = recordHistory(many, [{ id: "a", qty: 1 }], { at: i });
  assert.equal(many.length, MAX_HISTORY);
  assert.deepEqual(readHistory(JSON.parse(JSON.stringify(h))), h);
  assert.deepEqual(readHistory("x"), []);
  assert.deepEqual(readHistory([{ at: "soon", lines: [] }, { at: 5, lines: [{ id: 3, qty: 1 }] }, { at: 6, lines: [{ id: "a", qty: 99 }] }]), [{ at: 6, subtotal: null, lines: [{ id: "a", qty: 20 }] }]);
});

// ── points and promotions ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("points are counted once per order, and never from a bad number", () => {
  let st = readPoints(null);
  assert.deepEqual(st, { balance: 0, awarded: [] });
  st = awardPoints(st, "order-1", 13);
  assert.equal(st.balance, 13);
  assert.equal(awardPoints(st, "order-1", 13), st, "the same order checked again adds nothing");
  st = awardPoints(st, "order-2", 7.9);
  assert.equal(st.balance, 20, "whole points only");
  for (const bad of [0, -5, "x", NaN, null]) assert.equal(awardPoints(st, "order-3", bad), st, String(bad));
  assert.equal(awardPoints(st, "", 5), st);
  assert.deepEqual(readPoints(JSON.parse(JSON.stringify(st))), st);
  assert.deepEqual(readPoints({ balance: -4, awarded: [1, "a"] }), { balance: 0, awarded: ["a"] });
});

test("a promotion shows until the end of its last day (New York), or until it is removed when it has no end date", () => {
  const list = [{ title: "Open ended", text: "", until: "" }, { title: "Ends Dec 31", text: "", until: "2026-12-31" }, { title: "Ended", text: "", until: "2026-01-01" }, { title: "", until: "" }, null];
  const names = (now) => activePromotions(list, now).map((p) => p.title);
  assert.deepEqual(names(new Date("2026-06-01T12:00:00Z")), ["Open ended", "Ends Dec 31"]);
  assert.deepEqual(names(new Date("2027-01-01T04:30:00Z")), ["Open ended", "Ends Dec 31"], "still Dec 31 evening in New York");
  assert.deepEqual(names(new Date("2027-01-01T05:30:00Z")), ["Open ended"], "Jan 1 in New York");
  assert.deepEqual(activePromotions(undefined), []);
});

test("a choice the café has run out of cannot be picked, and one picked earlier is dropped", () => {
  const item = { id: "x", name: "Latte", cents: 450, optionSets: [{ id: "milk", label: "Milk", kind: "one", choices: [{ name: "Oat milk", cents: 100, out: true }, { name: "Almond milk", cents: 100 }] }] };
  assert.deepEqual(resolve(item, { picks: { milk: ["Oat milk"] } }).picks, {}, "sold out earlier choices are dropped");
  assert.deepEqual(resolve(item, { picks: { milk: ["Almond milk"] } }).picks, { milk: ["Almond milk"] });
  const before = { picks: {} };
  assert.equal(togglePick(item, before, "milk", "Oat milk"), before, "tapping a sold out choice does nothing");
  assert.equal(unitCents(item, { picks: { milk: ["Oat milk"] } }), 450, "and it adds no price");
});

test("the pause time from the server is read safely", () => {
  assert.equal(pausedMs("2026-11-16T15:45:00.000Z"), Date.parse("2026-11-16T15:45:00.000Z"));
  for (const bad of [undefined, null, "", "soon", 5, {}]) assert.equal(pausedMs(bad), 0);
});

test("rewards progress: the next goal, how far along, and what can be used already", () => {
  const rewards = [{ points: 250, title: "A free sandwich" }, { points: 100, title: "A free drink" }];
  assert.deepEqual(rewardProgress(rewards, 0), { ready: [], next: { points: 100, title: "A free drink" }, have: 0, left: 100, pct: 0 });
  const mid = rewardProgress(rewards, 40);
  assert.equal(mid.left, 60); assert.equal(mid.pct, 0.4);
  const some = rewardProgress(rewards, 130);
  assert.deepEqual(some.ready.map((r) => r.title), ["A free drink"]);
  assert.equal(some.next.title, "A free sandwich"); assert.equal(some.left, 120);
  const all = rewardProgress(rewards, 999);
  assert.equal(all.ready.length, 2); assert.equal(all.next, null); assert.equal(all.pct, 1);
  assert.deepEqual(rewardProgress(undefined, 50).ready, [], "no rewards set: nothing to show");
  assert.equal(rewardProgress(rewards, -5).have, 0);
});

test("using a reward takes its points off, never below zero", () => {
  const state = { balance: 130, awarded: ["a"] };
  assert.deepEqual(spendPoints(state, 100), { balance: 30, awarded: ["a"] });
  assert.equal(spendPoints(state, 200), state, "not enough points: nothing changes");
  for (const bad of [0, -1, NaN, "x", undefined]) assert.equal(spendPoints(state, bad), state);
});

test("the café's rewards from the server are cleaned and put in order", () => {
  const base = { business: {}, faq: [], packages: [] };
  const merged = mergeSite({ ...base, rewards: [] }, { rewards: [{ points: 200, title: "B" }, { points: "100", title: "A" }, { points: 0, title: "Zero" }, { points: 5 }, null] });
  assert.deepEqual(merged.rewards, [{ title: "A", points: 100 }, { title: "B", points: 200 }]);
});

test("Square Loyalty answers from the server are read safely", () => {
  assert.equal(readTiers(undefined), null, "no Loyalty: points are not kept in Square");
  assert.equal(readTiers({ tiers: "x" }), null);
  assert.deepEqual(readTiers({ tiers: [{ id: "b", name: "Drink", points: 100 }, { id: "a", name: "Cookie", points: 10.7 }, { name: "", points: 5 }, { id: "z", name: "Free", points: 0 }, null] }), { tiers: [{ id: "a", name: "Cookie", points: 10 }, { id: "b", name: "Drink", points: 100 }] });
  assert.deepEqual(readLookup({ ok: true, member: true, balance: 42.9, tiers: [{ id: "a", name: "Cookie", points: 10 }] }), { member: true, balance: 42, tiers: [{ id: "a", name: "Cookie", points: 10 }] });
  assert.deepEqual(readLookup({ ok: true, member: false, balance: -3 }), { member: false, balance: 0, tiers: [] });
  assert.equal(readLookup({ ok: false }), null);
  assert.equal(readLookup(null), null);
});

test("an order asks to earn points only when the customer ticked it", () => {
  const entries = [{ id: "x", qty: 1, choice: {} }];
  assert.equal(orderBody(entries, {}, { name: "Sam", phone: "7185550123", loyalty: true }).loyalty, true);
  assert.ok(!("loyalty" in orderBody(entries, {}, { name: "Sam", phone: "7185550123" })));
  assert.ok(!("loyalty" in orderBody(entries, {}, { name: "Sam", phone: "7185550123", loyalty: false })));
});

test("tips: a percentage of the subtotal before tax, or a typed amount, never more than the order", () => {
  assert.deepEqual(TIP_PERCENTS, [15, 20, 25]);
  assert.deepEqual(tipAmount("none", "", 1350), { cents: 0, error: "" });
  assert.deepEqual(tipAmount(15, "", 1350), { cents: 203, error: "" }, "15% of $13.50 is $2.025, rounded to the cent");
  assert.equal(tipAmount(20, "", 1350).cents, 270);
  assert.equal(tipAmount(25, "", 0).cents, 0, "nothing to tip on an empty order");
  assert.deepEqual(tipAmount("custom", "2.50", 1350), { cents: 250, error: "" });
  assert.deepEqual(tipAmount("custom", "$2", 1350), { cents: 200, error: "" });
  assert.deepEqual(tipAmount("custom", "", 1350), { cents: 0, error: "" }, "Other with nothing typed is no tip");
  assert.match(tipAmount("custom", "two", 1350).error, /like 2 or 2\.50/);
  assert.match(tipAmount("custom", "2.555", 1350).error, /like 2 or 2\.50/);
  assert.match(tipAmount("custom", "50", 1350).error, /more than the order/);
  assert.equal(tipAmount("custom", "5", 100).cents, 500, "a small order can still take a $5 tip");
});

test("the tip travels with the order only when there is one", () => {
  const entries = [{ id: "x", qty: 1, choice: {} }];
  assert.equal(orderBody(entries, {}, { name: "Sam", phone: "7185550123", tipCents: 203 }).tipCents, 203);
  assert.ok(!("tipCents" in orderBody(entries, {}, { name: "Sam", phone: "7185550123", tipCents: 0 })));
  assert.ok(!("tipCents" in orderBody(entries, {}, { name: "Sam", phone: "7185550123" })));
});

test("dietary tags: only the tags the café ticked are offered, in a fixed order, and filtering keeps just those items", () => {
  const menu = { groups: { Drinks: { Coffee: [{ id: "a", name: "A", diet: ["Vegan", "Dairy-free"] }, { id: "b", name: "B" }, { id: "h", name: "Hidden", hidden: true, diet: ["Nut-free"] }], Tea: [{ id: "c", name: "C", diet: ["Vegan"] }] }, Food: { Sandwiches: [{ id: "d", name: "D", diet: ["Vegetarian", "Gluten-free"] }] } } };
  assert.deepEqual(dietsPresent(menu), ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free"], "a hidden item's tag is not offered");
  assert.deepEqual(dietsPresent({ groups: { Drinks: { Coffee: [{ id: "x", name: "X" }] } } }), [], "no tags until the café ticks some");
  assert.deepEqual(dietsPresent(undefined), []);
  const cats = [{ name: "Coffee", group: "Drinks", items: menu.groups.Drinks.Coffee.filter((i) => !i.hidden) }, { name: "Tea", group: "Drinks", items: menu.groups.Drinks.Tea }, { name: "Sandwiches", group: "Food", items: menu.groups.Food.Sandwiches }];
  assert.equal(filterByDiet(cats, null), cats, "no tag chosen: nothing is filtered");
  assert.deepEqual(filterByDiet(cats, "Vegan").map((c) => [c.name, c.items.map((i) => i.id)]), [["Coffee", ["a"]], ["Tea", ["c"]]], "only vegan items, and categories without any disappear");
  assert.deepEqual(filterByDiet(cats, "Gluten-free").map((c) => c.name), ["Sandwiches"]);
  assert.deepEqual(filterByDiet(cats, "Nut-free"), []);
});

test("What's new: only items the café labelled New or Seasonal, New first, never hidden ones, nothing by default", () => {
  const menu = { groups: { Drinks: { Coffee: [{ id: "a", name: "A", badge: "Seasonal" }, { id: "b", name: "B", badge: "New" }, { id: "c", name: "C" }, { id: "d", name: "D", badge: "New", hidden: true }, { id: "e", name: "E", badge: "Popular" }] }, Food: { Sandwiches: [{ id: "f", name: "F", badge: "New" }] } } };
  assert.deepEqual(newItems(menu).map((i) => i.id), ["b", "f", "a"], "New first (in menu order), then Seasonal; Popular, unlabelled and hidden items are not here");
  assert.equal(newItems(menu, 2).length, 2);
  assert.deepEqual(newItems({ groups: { Drinks: { Coffee: [{ id: "x", name: "X" }] } } }), []);
  assert.deepEqual(newItems(undefined), []);
});

test("the greeting uses the first name the customer gave, and nothing odd", () => {
  const noon = new Date("2026-10-08T12:00:00Z");   // 8 AM in New York
  assert.equal(greeting(noon, "Sam Lee"), "Good morning, Sam");
  assert.equal(greeting(noon, "  maria-jose  "), "Good morning, maria-jose");
  assert.equal(greeting(noon, ""), "Good morning");
  assert.equal(greeting(noon, undefined), "Good morning");
  assert.equal(greeting(noon, "<b>Sam"), "Good morning, bSam", "markup characters are dropped");
  assert.equal(greeting(noon, "1234"), "Good morning", "nothing left of the name: no comma");
  assert.equal(greeting(new Date("2026-10-08T23:00:00Z"), "Sam"), "Good evening, Sam");
});

test("the small line under a price shows only the dietary tags the café ticked", () => {
  assert.equal(itemFacts({ diet: ["Vegan", "Gluten-free"] }), "Vegan · Gluten-free");
  assert.equal(itemFacts({ cal: "190", diet: ["Vegan"] }), "Vegan", "calories are never shown, even if old data has them");
  assert.equal(itemFacts({ cal: "80" }), "");
  assert.equal(itemFacts({ name: "x" }), "", "nothing ticked: nothing shown");
  assert.equal(itemFacts(undefined), "");
});

test("recent searches: newest first, five at most, no repeats, nothing too short", () => {
  assert.deepEqual(addSearch([], "latte"), ["latte"]);
  assert.deepEqual(addSearch(["latte", "wrap"], "Wrap"), ["Wrap", "latte"], "a repeat moves to the front (any capitals)");
  assert.deepEqual(addSearch(["a1", "b2", "c3", "d4", "e5"], "f6"), ["f6", "a1", "b2", "c3", "d4"]);
  assert.deepEqual(addSearch(["latte"], "x"), ["latte"], "one letter is not remembered");
  assert.deepEqual(addSearch(["latte"], "   "), ["latte"]);
  assert.deepEqual(readSearches([" latte ", 5, null, "LATTE", "wrap"]), ["latte", "wrap"]);
  assert.deepEqual(readSearches("nope"), []);
});

test("order notifications: only when it turns ready or is canceled, and never twice for no change", () => {
  assert.deepEqual(notificationFor("accepted", "ready", "K7QF"), { title: "Your order is ready", body: "Order K7QF is ready for pickup at Maruf Cafe.", kind: "ready" });
  assert.equal(notificationFor("ready", "ready", "K7QF"), null, "no change, no notification");
  assert.equal(notificationFor("received", "accepted", "K7QF"), null, "accepted is not worth waking someone for");
  assert.equal(notificationFor("ready", "done", "K7QF"), null);
  assert.equal(notificationFor("accepted", "canceled", "K7QF").kind, "canceled");
  assert.match(notificationFor(null, "ready", "").body, /^Order is ready for pickup/, "no code: no stray space or placeholder");
});

test("Picked for you: untried items from the categories they order from most, nothing before a first order", () => {
  const menu = { groups: { Drinks: { Coffee: [{ id: "c1", name: "Latte", cents: 450 }, { id: "c2", name: "Mocha", cents: 500, badge: "New" }, { id: "c3", name: "Drip", cents: 300 }, { id: "c4", name: "Hidden", cents: 300, hidden: true }], Tea: [{ id: "t1", name: "Chai", cents: 400 }, { id: "t2", name: "Green", cents: 350 }] }, Food: { Sandwiches: [{ id: "s1", name: "Wrap", cents: 900 }] } } };
  assert.deepEqual(pickedForYou(menu, []).map((i) => i.id), [], "no orders yet: nothing is guessed");
  assert.deepEqual(pickedForYou(menu, undefined), []);
  const history = [{ lines: [{ id: "c1", qty: 2 }] }, { lines: [{ id: "c1", qty: 1 }, { id: "t1", qty: 1 }] }];
  const got = pickedForYou(menu, history).map((i) => i.id);
  assert.deepEqual(got, ["c2", "t2", "c3"], "Coffee (ordered most) first, its New item before the rest, then one from Tea, then more Coffee; tried, hidden and other-category items are left out");
  assert.ok(!got.includes("c1") && !got.includes("t1") && !got.includes("c4") && !got.includes("s1"));
  assert.equal(pickedForYou(menu, history, 2).length, 2);
  assert.deepEqual(pickedForYou(menu, [{ lines: [{ id: "gone", qty: 1 }] }]), [], "an item no longer on the menu says nothing");
});

test("Settings choices: only known values are accepted, anything else falls back to the default", () => {
  assert.equal(cleanPref("appearance", "dark"), "dark");
  assert.equal(cleanPref("appearance", "light"), "light");
  assert.equal(cleanPref("appearance", "purple"), "auto");
  assert.equal(cleanPref("appearance", undefined), "auto");
  assert.equal(cleanPref("menuLayout", "list"), "list");
  assert.equal(cleanPref("menuLayout", "grid"), "swipe");
  assert.equal(cleanPref("nonsense", "x"), undefined);
  assert.deepEqual(DEFAULTS, { appearance: "auto", menuLayout: "swipe" });
});

test("how the café takes payment is read safely from the server's settings", () => {
  assert.deepEqual(readPayments({ applicationId: "sandbox-sq0idb-ABC123", locationId: "L88917AVBK2S5", environment: "sandbox" }), { applicationId: "sandbox-sq0idb-ABC123", locationId: "L88917AVBK2S5", environment: "sandbox" });
  assert.equal(readPayments({ applicationId: "sq0idp-XYZ789", locationId: "LOC1", environment: "production" }).environment, "production");
  assert.equal(readPayments({ applicationId: "sq0idp-XYZ789", locationId: "LOC1", environment: "weird" }).environment, "sandbox", "an unknown environment is treated as the safe one");
  for (const bad of [undefined, null, "x", {}, { applicationId: "abc", locationId: "LOC1" }, { applicationId: "sq0idp-XYZ789" }, { applicationId: "has spaces!!", locationId: "LOC1" }, { applicationId: "sq0idp-XYZ789", locationId: "<script>" }]) assert.equal(readPayments(bad), null, JSON.stringify(bad));
});
