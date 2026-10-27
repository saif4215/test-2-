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
