/** The last few turns, trimmed to what the server accepts. */
export const trimHistory = (messages, max = 10) => messages.filter((m) => !m.error).slice(-max).map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));

/**
 * The items the assistant put together, checked against the menu this phone has: only real, shown items, whole quantities from 1 to 20.
 * The assistant never sets a price. Prices always come from the menu. Returns [{ id, qty, note, item }].
 */
export function readProposal(add, itemsById) {
  if (!Array.isArray(add)) return [];
  const out = [];
  for (const a of add.slice(0, 10)) {
    const item = typeof a?.id === "string" ? itemsById.get(a.id) : null, qty = Math.floor(Number(a?.qty));
    if (!item || item.hidden || !(qty >= 1) || out.some((o) => o.id === item.id)) continue;
    out.push({ id: item.id, qty: Math.min(20, qty), note: typeof a.note === "string" ? a.note.replace(/\s+/g, " ").trim().slice(0, 100) : "", item });
  }
  return out;
}

/** What a proposal costs before tax: { low, high, exact }. An item priced by size counts from its lowest price. */
export function proposalTotal(list) {
  const low = list.reduce((s, l) => s + (l.item.cents ?? l.item.min) * l.qty, 0), high = list.reduce((s, l) => s + (l.item.cents ?? l.item.max) * l.qty, 0);
  return { low, high, exact: low === high };
}

/** The note to keep for an item once the assistant's note is added to one the customer already has. */
export function mergeNote(existing, added) {
  const a = String(existing || "").trim(), b = String(added || "").trim();
  if (!b || a.toLowerCase().includes(b.toLowerCase())) return a;
  return `${a}${a ? "; " : ""}${b}`.slice(0, 100);
}
