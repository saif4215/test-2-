// What the app remembers on the phone: favorite items and recent orders. Plain functions, so they are tested without a phone.

export const MAX_RECENT = 5;

/** Add the id to the favorites, or take it off if it is already there. Newest first. */
export function toggleFavorite(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
}

/**
 * Remember an order the customer sent: [{ id, qty }], newest first, at most MAX_RECENT. An empty order is not remembered,
 * and sending the same items again moves that order to the front instead of listing it twice.
 */
export function recordOrder(history, entries) {
  const lines = entries.filter((l) => l && l.id && l.qty > 0).map((l) => ({ id: l.id, qty: l.qty }));
  if (!lines.length) return history;
  const key = (o) => o.map((l) => `${l.id}:${l.qty}`).sort().join("|");
  return [lines, ...history.filter((h) => key(h) !== key(lines))].slice(0, MAX_RECENT);
}

/** The most recent order, as [{ id, qty }], or []. */
export const lastOrder = (history) => history[0] || [];

/** Items for an "Order again" row: the ids of the last order that are still on the menu, each once. */
export function reorderIds(history, itemsById) {
  return lastOrder(history).map((l) => l.id).filter((id, i, a) => a.indexOf(id) === i && itemsById.has(id));
}

/** Parse what was saved, forgetting anything that does not look right. */
export function readSaved(raw, fallback) {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
}
