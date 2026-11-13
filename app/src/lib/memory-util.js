// What the app remembers on the phone: favorite items and recent orders. Plain functions, so they are tested without a phone.

export const MAX_RECENT = 5;

/** Add the id to the favorites, or take it off if it is already there. Newest first. */
export function toggleFavorite(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
}

/**
 * Remember an order the customer sent: [{ id, qty, choice? }], newest first, at most MAX_RECENT. `choice` is the size and choices they picked,
 * so ordering again brings back the same drink. An empty order is not remembered, and sending the same order again moves it to the front instead of listing it twice.
 */
export function recordOrder(history, entries) {
  const lines = entries.filter((l) => l && l.id && l.qty > 0).map((l) => ({ id: l.id, qty: l.qty, ...(l.choice && typeof l.choice === "object" ? { choice: l.choice } : {}) }));
  if (!lines.length) return history;
  const key = (o) => o.map((l) => `${l.id}:${l.qty}:${JSON.stringify(l.choice || null)}`).sort().join("|");
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

// ── "My usual" drinks and the list of past orders ──────────────────────────────────────────────────────────────────────────────────
export const MAX_USUALS = 12, MAX_HISTORY = 20;

const choiceOf = (c) => {
  if (!c || typeof c !== "object" || Array.isArray(c)) return {};
  const out = {};
  if (typeof c.size === "string" && c.size) out.size = c.size.slice(0, 30);
  if (c.picks && typeof c.picks === "object" && !Array.isArray(c.picks)) {
    const picks = {};
    for (const id of Object.keys(c.picks).slice(0, 16)) if (id.length <= 40 && Array.isArray(c.picks[id]) && c.picks[id].length) picks[id] = c.picks[id].filter((x) => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 40));
    if (Object.keys(picks).length) out.picks = picks;
  }
  return out;
};

/** Save a drink the way the customer likes it: { id, itemId, name, choice }, newest first. Saving the same item with the same choices again only moves it to the front. */
export function addUsual(list, { itemId, name, choice }, makeId = () => Math.random().toString(36).slice(2, 10)) {
  if (typeof itemId !== "string" || !itemId) return list;
  const c = choiceOf(choice), key = (u) => `${u.itemId}|${JSON.stringify(u.choice)}`;
  const entry = { id: makeId(), itemId, name: str(name, 80) || "My usual", choice: c };
  return [entry, ...list.filter((u) => key(u) !== key(entry))].slice(0, MAX_USUALS);
}

export const removeUsual = (list, id) => list.filter((u) => u.id !== id);

/** Parse the saved usuals, forgetting anything that does not look right. */
export function readUsuals(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((u) => u && typeof u.id === "string" && typeof u.itemId === "string").slice(0, MAX_USUALS).map((u) => ({ id: u.id.slice(0, 20), itemId: u.itemId.slice(0, 80), name: str(u.name, 80) || "My usual", choice: choiceOf(u.choice) }));
}

/** Keep a past order for the history screen: { at, subtotal, lines: [{ id, qty, choice? }] }, newest first. An empty order is not kept. */
export function recordHistory(history, entries, { at = Date.now(), subtotal = null } = {}) {
  const lines = entries.filter((l) => l && l.id && l.qty > 0).map((l) => ({ id: l.id, qty: l.qty, ...(l.choice && Object.keys(choiceOf(l.choice)).length ? { choice: choiceOf(l.choice) } : {}) }));
  if (!lines.length) return history;
  return [{ at, subtotal: Number.isFinite(subtotal) ? subtotal : null, lines }, ...history].slice(0, MAX_HISTORY);
}

/** Parse the saved history, forgetting anything that does not look right. */
export function readHistory(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const o of v.slice(0, MAX_HISTORY)) {
    if (!o || !Array.isArray(o.lines) || !Number.isFinite(Number(o.at))) continue;
    const lines = o.lines.filter((l) => l && typeof l.id === "string" && Number(l.qty) >= 1).slice(0, 40).map((l) => ({ id: l.id.slice(0, 80), qty: Math.min(20, Math.floor(Number(l.qty))), ...(Object.keys(choiceOf(l.choice)).length ? { choice: choiceOf(l.choice) } : {}) }));
    if (lines.length) out.push({ at: Number(o.at), subtotal: Number.isFinite(Number(o.subtotal)) && o.subtotal !== null ? Number(o.subtotal) : null, lines });
  }
  return out;
}

// ── "My order" kept on the phone, so closing the app does not lose it ─────────────────────────────────────────────────────────────
export const MAX_QTY = 20;   // the café's server takes at most 20 of one item in an order

const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

/** Keep only a size and choices of the right shape, so a damaged (or older) saved order can never crash a screen. The menu decides later which ones still exist. */
export function readCustom(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const picks = {};
  if (c.picks && typeof c.picks === "object" && !Array.isArray(c.picks)) {
    for (const id of Object.keys(c.picks).slice(0, 16)) if (id.length <= 40 && Array.isArray(c.picks[id])) picks[id] = c.picks[id].filter((x) => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 40));
  }
  return { size: str(c.size, 30), picks };
}

/** What was saved of the order: { lines: id -> qty, notes: id -> text, custom: id -> size and choices }. Anything that does not look right is dropped. */
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
