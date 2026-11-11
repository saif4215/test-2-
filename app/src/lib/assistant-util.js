import { unitCents } from "./customize";

/** The last few turns, trimmed to what the server accepts. */
export const trimHistory = (messages, max = 10) => messages.filter((m) => !m.error).slice(-max).map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));

/**
 * The items the assistant put together, checked against the menu this phone has: only real, shown items, whole quantities from 1 to 20.
 * The assistant never sets a price. Prices always come from the menu: `unit` is the price of one with the size and choices it named. Returns [{ id, qty, note, choice, unit, item }].
 */
export function readProposal(add, itemsById) {
  if (!Array.isArray(add)) return [];
  const out = [];
  for (const a of add.slice(0, 10)) {
    const item = typeof a?.id === "string" ? itemsById.get(a.id) : null, qty = Math.floor(Number(a?.qty));
    if (!item || item.hidden || !(qty >= 1) || out.some((o) => o.id === item.id)) continue;
    const choice = { size: typeof a.size === "string" ? a.size.slice(0, 30) : "", picks: a.picks && typeof a.picks === "object" && !Array.isArray(a.picks) ? a.picks : {} };   // checked against what the item offers when it is used
    out.push({ id: item.id, qty: Math.min(20, qty), note: typeof a.note === "string" ? a.note.replace(/\s+/g, " ").trim().slice(0, 100) : "", choice, unit: unitCents(item, choice), item });
  }
  return out;
}

/** What a proposal costs before tax: { low, high, exact }. An item that only has a price range counts from its lowest price. */
export function proposalTotal(list) {
  const low = list.reduce((s, l) => s + (l.unit ?? l.item.min) * l.qty, 0), high = list.reduce((s, l) => s + (l.unit ?? l.item.max) * l.qty, 0);
  return { low, high, exact: low === high };
}

/** The note to keep for an item once the assistant's note is added to one the customer already has. */
export function mergeNote(existing, added) {
  const a = String(existing || "").trim(), b = String(added || "").trim();
  if (!b || a.toLowerCase().includes(b.toLowerCase())) return a;
  return `${a}${a ? "; " : ""}${b}`.slice(0, 100);
}
