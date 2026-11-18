// Plain helpers for the order list, kept free of React so they are tested without a phone.

/** The text sent with a quote request: "2 x Americano (oat milk if you have it)". A note is whatever the customer typed for that item. */
export function orderSummary(entries, notes = {}) {
  return entries.map((l) => {
    const note = String(notes[l.id] || "").trim();
    return `${l.qty} x ${l.name}${note ? ` (${note})` : ""}`;
  }).join("\n");
}

/** Keep a typed note short and on one line. */
export const cleanNote = (s) => String(s || "").replace(/\s+/g, " ").slice(0, 100);

/** Items with one fixed price can be sent from the app. An item with a price range depends on its size, so the counter prices it. */
export function splitOrderable(entries) {
  return { ready: entries.filter((l) => l.cents != null), needsPrice: entries.filter((l) => l.cents == null) };
}

/** What the customer typed on the pickup screen, as the server expects it, or per-field errors. The phone is kept as 10 digits. */
export function buildPickup(v) {
  const errors = {};
  const name = String(v.name || "").replace(/\s+/g, " ").trim();
  if (!name) errors.name = "Enter a name for the order."; else if (name.length > 60) errors.name = "Use a shorter name.";
  const digits = String(v.phone || "").replace(/\D/g, "");
  const phone = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (phone.length !== 10) errors.phone = "Enter a 10-digit phone number so the café can reach you.";
  const note = String(v.note || "").replace(/\s+/g, " ").trim().slice(0, 200);
  return { errors, fields: { name, phone, note } };
}

/**
 * The request body for the server: for each line the id, how many, the size and choices (the server looks up what they cost, so a price can never come from the app)
 * and whatever the customer typed for that item. `notes` is id -> typed text.
 */
export function orderBody(entries, notes, fields) {
  return {
    items: entries.map((l) => ({ id: l.id, qty: l.qty, ...(l.choice || {}), ...(notes[l.id] ? { note: notes[l.id] } : {}) })),
    name: fields.name, phone: fields.phone, ...(fields.note ? { note: fields.note } : {}), ...(fields.pickupAt ? { pickupAt: fields.pickupAt } : {}), ...(fields.loyalty ? { loyalty: true } : {}), ...(fields.tipCents > 0 ? { tipCents: fields.tipCents } : {}),
  };
}

/** The tips offered at checkout, as percentages of the subtotal before tax. */
export const TIP_PERCENTS = [15, 20, 25];

/**
 * The tip the customer plans to leave, in cents. mode is "none", one of TIP_PERCENTS, or "custom" (typed dollars like "2" or "2.50").
 * Returns { cents, error }. A tip is only a note for the cashier: it is never added to the order's total.
 */
export function tipAmount(mode, custom, subtotalCents) {
  if (mode === "none" || mode == null) return { cents: 0, error: "" };
  if (TIP_PERCENTS.includes(mode)) return { cents: Number.isFinite(subtotalCents) && subtotalCents > 0 ? Math.round((subtotalCents * mode) / 100) : 0, error: "" };
  const t = String(custom || "").replace(/[$,\s]/g, "");
  if (!t) return { cents: 0, error: "" };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { cents: 0, error: "Type a tip like 2 or 2.50." };
  const cents = Math.round(parseFloat(t) * 100);
  if (cents > 20000 || (Number.isFinite(subtotalCents) && cents > Math.max(subtotalCents, 500))) return { cents: 0, error: "That tip is more than the order. Try a smaller amount." };
  return { cents, error: "" };
}

/** A key the server uses to make sure one order is never made twice. Not a secret, only unique enough. */
export function newKey(rand = Math.random) {
  let s = "";
  while (s.length < 32) s += Math.floor(rand() * 16).toString(16);
  return s;
}

/**
 * Keep the same key for the same order, so pressing Place order again after a bad connection can never make two orders,
 * and give a changed order a new key. Returns { sig, key } to hold on to.
 */
export function keyFor(prev, body, make = newKey) {
  const sig = JSON.stringify(body);
  return prev && prev.sig === sig ? prev : { sig, key: make() };
}

/** What each stage of an order means to the customer, from the café's side. */
export const ORDER_STAGES = [{ id: "received", label: "Sent" }, { id: "accepted", label: "Accepted" }, { id: "ready", label: "Ready" }];
const STAGE_TEXT = {
  received: ["Order sent", "Maruf Cafe has your order. It isn't confirmed until the café accepts it."],
  accepted: ["Maruf Cafe accepted your order", "Check back here to see when it's ready."],
  ready: ["Ready for pickup", "Come to the counter and pay there."],
  done: ["Picked up", "Thank you for ordering from Maruf Cafe!"],
  canceled: ["This order was canceled", "Please call the café if you have questions."],
};
export const FINAL_STATUSES = ["done", "canceled"];
export function stageInfo(status) {
  const known = status in STAGE_TEXT ? status : "received";
  const [title, text] = STAGE_TEXT[known];
  return { status: known, title, text, step: known === "received" ? 0 : known === "accepted" ? 1 : known === "canceled" ? -1 : 2, final: FINAL_STATUSES.includes(known) };
}

/** The tax shown as an estimate: the café's percentage of the subtotal, in cents. Square works out the real amount on the order. */
export const estimateTax = (cents, percent) => (percent > 0 ? Math.round((cents * percent) / 100) : 0);

/** When the café's pause on new orders ends, in milliseconds (0 when orders are open or the server said nothing usable). */
export const pausedMs = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : 0; };

/** The café's Square Loyalty rewards from the server: { tiers: [{ id, name, points }] } smallest first, or null when points are not kept in Square. */
export function readTiers(v) {
  if (!v || typeof v !== "object" || !Array.isArray(v.tiers)) return null;
  const tiers = v.tiers.filter((t) => t && typeof t.name === "string" && t.name && Number(t.points) >= 1).map((t) => ({ id: String(t.id || t.name), name: t.name, points: Math.floor(Number(t.points)) })).sort((a, b) => a.points - b.points);
  return { tiers };
}

/** A points lookup answer: { member, balance, tiers } with safe numbers, or null when it is not usable. */
export function readLookup(v) {
  if (!v || v.ok !== true) return null;
  const balance = Number(v.balance);
  return { member: v.member === true, balance: Number.isFinite(balance) && balance > 0 ? Math.min(Math.floor(balance), 10000000) : 0, tiers: (readTiers({ tiers: v.tiers }) || { tiers: [] }).tiers };
}

/** The title and words for an order's change of status, or null when it is not worth a notification. Pure, so it is tested without a phone. */
export function notificationFor(prev, next, ref) {
  if (next === prev) return null;
  const tag = ref ? ` ${ref}` : "";
  if (next === "ready") return { title: "Your order is ready", body: `Order${tag} is ready for pickup at Maruf Cafe.`, kind: "ready" };
  if (next === "canceled") return { title: "Your order was canceled", body: `Order${tag} was canceled. Please call the café if you have questions.`, kind: "canceled" };
  return null;
}


/** How the café takes payment in the app, from the server's settings: { applicationId, locationId, environment }, or null when it does not (the customer then pays at the counter). */
export function readPayments(v) {
  if (!v || typeof v !== "object") return null;
  const ok = (s, re) => typeof s === "string" && re.test(s);
  if (!ok(v.applicationId, /^[A-Za-z0-9_-]{6,80}$/) || !ok(v.locationId, /^[A-Za-z0-9_-]{2,60}$/)) return null;
  return { applicationId: v.applicationId, locationId: v.locationId, environment: v.environment === "production" ? "production" : "sandbox" };
}
