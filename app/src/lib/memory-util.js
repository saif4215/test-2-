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

/** Like readSaved, for something stored as an object (not a list). */
export function readObject(raw, fallback) {
  try { const v = JSON.parse(raw); return v && typeof v === "object" && !Array.isArray(v) ? v : fallback; } catch { return fallback; }
}

// ── "My order" kept on the phone, so closing the app does not lose it ─────────────────────────────────────────────────────────────
export const MAX_QTY = 20;   // the café's server takes at most 20 of one item in an order

const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v, n) => Math.max(0, Math.min(n, Math.floor(Number(v) || 0)));

/** Keep only the drink choices we know, with the right kinds of values, so a damaged saved order can never crash a screen. */
export function readCustom(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const out = { size: str(c.size, 30), temp: str(c.temp, 30), shots: num(c.shots, 10), flavor: str(c.flavor, 30), pumps: num(c.pumps, 20), milk: str(c.milk, 30), ice: str(c.ice, 30), sweetness: str(c.sweetness, 30), extras: Array.isArray(c.extras) ? c.extras.filter((x) => typeof x === "string").slice(0, 10).map((x) => x.slice(0, 30)) : [] };
  return out;
}

/** What was saved of the order: { lines: id -> qty, notes: id -> text, custom: id -> drink choices }. Anything that does not look right is dropped. */
export function readCart(v) {
  const out = { lines: {}, notes: {}, custom: {} };
  if (!v || typeof v !== "object" || !v.lines || typeof v.lines !== "object" || Array.isArray(v.lines)) return out;
  for (const id of Object.keys(v.lines).slice(0, 40)) {
    const q = Math.floor(Number(v.lines[id]));
    if (!(q >= 1) || id.length > 80) continue;
    out.lines[id] = Math.min(MAX_QTY, q);
    const note = str(v.notes?.[id], 100);
    if (note.trim()) out.notes[id] = note;
    const custom = readCustom(v.custom?.[id]);
    if (custom) out.custom[id] = custom;
  }
  return out;
}

/** What to save: only the items that are in the order. */
export function cartToSave({ lines, notes, custom }) {
  const keep = (map) => Object.fromEntries(Object.entries(map).filter(([id]) => id in lines));
  return { lines, notes: keep(notes), custom: keep(custom) };
}

// ── the order that was just placed, so Home can show where it stands ──────────────────────────────────────────────────────────────
export const ACTIVE_HOURS = 12;

/** The order placed most recently, if it is still worth showing (placed in the last 12 hours). */
export function readActive(v, now = Date.now()) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const at = Number(v.at);
  if (typeof v.id !== "string" || !/^[A-Za-z0-9_-]{4,80}$/.test(v.id)) return null;
  if (!Number.isFinite(at) || at > now + 3600000 || now - at > ACTIVE_HOURS * 3600000) return null;
  return { id: v.id, ref: str(v.ref, 8), name: str(v.name, 60), total: Number.isFinite(Number(v.total)) && v.total !== "" && v.total !== null ? Number(v.total) : null, at, preview: v.preview === true };
}
