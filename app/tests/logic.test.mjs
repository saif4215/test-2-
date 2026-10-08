// Run with: npm test   (plain Node, no phone or browser needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, parseTime, isPast, openStatus } from "../src/lib/dates.js";
import { buildQuote, buildEvent, QUOTE_THANKS, EVENT_THANKS } from "../src/lib/forms.js";
import { plan, quantityFor } from "../src/lib/plan.js";
import { mergeSite, indexMenu } from "../src/lib/site-merge.js";

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
