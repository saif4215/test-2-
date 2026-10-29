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

/** The request body for the server: ids and quantities only (the server looks up every price), plus what was asked for on each item. */
export function orderBody(entries, details, fields) {
  return {
    items: entries.map((l) => ({ id: l.id, qty: l.qty, ...(details[l.id] ? { note: details[l.id] } : {}) })),
    name: fields.name, phone: fields.phone, ...(fields.note ? { note: fields.note } : {}),
  };
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
