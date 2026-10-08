// The quote and event request forms: what each field is, how it is cleaned, and which are required.
// Used by the server (to validate) and tested on its own.

export class FormError extends Error {
  constructor(message, fields = []) { super(message); this.fields = fields; }
}

const short = (max = 200) => (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const long = (v) => (typeof v === "string" ? v.trim().slice(0, 2000) : "");
const oneOf = (...allowed) => (v) => (allowed.includes(v) ? v : "");
const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(`${v}T12:00:00Z`).toISOString().startsWith(v) ? v : "");
const clock = (v) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");
const count = (max) => (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= max ? String(n) : ""; };

/** Today's date in New York as YYYY-MM-DD. */
export function todayNY(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const contactMethod = oneOf("phone", "text", "email");

/** field -> [label, cleaner, required]. The order here is the order shown in emails and the admin dashboard. */
export const FORMS = {
  "large-order": {
    title: "Large order quote request",
    fields: {
      fullName: ["Full name", short(100), true], phone: ["Phone", short(40), true], email: ["Email", short(120), true],
      contactMethod: ["Best way to reach you", contactMethod, false],
      dateNeeded: ["Date needed", isoDate, true], fulfillment: ["Pickup or delivery", oneOf("pickup", "delivery"), true],
      deliveryAddress: ["Delivery address", short(250), false],
      people: ["Number of people", count(5000), true], pickupTime: ["Preferred pickup or delivery time", clock, false],
      foodItems: ["Food items", long, true], dietary: ["Allergies or dietary needs", long, false],
      specialRequests: ["Special requests", long, false], budget: ["Budget", short(100), false],
      notes: ["Additional notes", long, false], occasion: ["Occasion", short(100), false],
    },
  },
  event: {
    title: "Event rental request",
    fields: {
      name: ["Name", short(100), true], phone: ["Phone", short(40), true], email: ["Email", short(120), true],
      contactMethod: ["Best way to reach you", contactMethod, false],
      eventType: ["Type of event", short(100), true], eventDate: ["Event date", isoDate, true], alternateDate: ["Backup date", isoDate, false],
      startTime: ["Start time", clock, false], endTime: ["End time", clock, false], guests: ["Number of guests", count(1000), true],
      needFood: ["Will you need food?", oneOf("yes", "no", "unsure"), false], catering: ["Catering required?", oneOf("yes", "no", "unsure"), false],
      foodBudget: ["Estimated food budget", short(100), false], budget: ["Overall event budget", short(100), false],
      venueType: ["Venue", oneOf("private-event", "full-venue", "partial-area", "other"), false],
      dietary: ["Allergies or dietary needs", long, false],
      specialRequests: ["Special requests", long, false], decorations: ["Decorations", long, false],
      entertainment: ["Entertainment", long, false], notes: ["Other notes", long, false], packageInterest: ["Option asked about", short(100), false],
    },
  },
};

const DISPLAY = { pickup: "Pickup", delivery: "Delivery", phone: "Phone call", text: "Text message", email: "Email", yes: "Yes", no: "No", unsure: "Not sure", "private-event": "Private event", "full-venue": "Full venue rental", "partial-area": "Partial / private area", other: "Other" };
/** Human-readable value for emails and the dashboard. */
export function display(key, value) {
  if (DISPLAY[value] && !/^(people|guests)$/.test(key)) return DISPLAY[value];
  if (/Date$|^dateNeeded$|^eventDate$/.test(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  if (/Time$/.test(key) && /^\d{2}:\d{2}$/.test(value)) {
    const [h, mi] = value.split(":").map(Number);
    return `${h % 12 || 12}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
  return value;
}

/** Validate a submitted request. Returns { type, title, clean, labels } or throws FormError naming the fields to fix. */
export function parseInquiry(body, now = new Date()) {
  if (!body || typeof body !== "object") throw new FormError("Invalid request.");
  const form = FORMS[body.type];
  if (!form) throw new FormError("Invalid request.");
  const clean = {}, bad = new Set();
  for (const [key, [, fn, required]] of Object.entries(form.fields)) {
    const v = fn(body.fields?.[key]);
    if (v) clean[key] = v; else if (required) bad.add(key);
  }
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email)) { delete clean.email; bad.add("email"); }
  if (clean.phone && clean.phone.replace(/\D/g, "").length < 7) { delete clean.phone; bad.add("phone"); }
  const today = todayNY(now);
  for (const k of ["dateNeeded", "eventDate"]) if (clean[k] && clean[k] < today) { delete clean[k]; bad.add(k); }
  if (clean.alternateDate && clean.alternateDate < today) { delete clean.alternateDate; bad.add("alternateDate"); }
  if (body.type === "large-order" && clean.fulfillment === "delivery" && !clean.deliveryAddress) bad.add("deliveryAddress");
  if (clean.fulfillment === "pickup") delete clean.deliveryAddress;
  if (clean.startTime && clean.endTime && clean.endTime <= clean.startTime) { delete clean.endTime; bad.add("endTime"); }
  if (bad.size) throw new FormError("Please check the highlighted fields.", [...bad]);
  return { type: body.type, title: form.title, clean, labels: Object.fromEntries(Object.entries(form.fields).map(([k, [l]]) => [k, l])) };
}
