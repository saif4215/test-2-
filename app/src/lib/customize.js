// "Make it your way": the size and choices an item offers, what the customer picked, and the price that adds up to. Plain functions, tested without a phone.
//
// Everything an item offers comes from the café's menu (see lib/options.mjs on the server, which prices the real order the same way):
//   item.sizes      [{ name, cents }]  the first one is the default
//   item.optionSets [{ id, label, kind: "one" | "many", required?, max?, choices: [{ name, cents }] }]   (the menu's option groups this item uses)
// What the customer picked is { size, picks: { setId: [names] } }. Nothing picked means the first size and the required defaults.

export const EMPTY = Object.freeze({ size: "", picks: Object.freeze({}) });

const money = (c) => `$${(c / 100).toFixed(2)}`;
/** "+$1.00" or "Free" for a choice. */
export const extraText = (cents) => (cents > 0 ? `+${money(cents)}` : "");

/** Does this item offer anything to choose? */
export const hasOffers = (item) => !!(item && ((item.sizes && item.sizes.length > 1) || (item.optionSets && item.optionSets.length)));

/** The choice as it will really be ordered: the size filled in, required choices filled in, and anything the menu no longer offers dropped. */
export function resolve(item, custom) {
  const c = custom && typeof custom === "object" ? custom : {};
  const sizes = (item && item.sizes) || [];
  const size = sizes.length ? (sizes.some((s) => s.name === c.size) ? c.size : sizes[0].name) : "";
  const picks = {};
  for (const set of (item && item.optionSets) || []) {
    const asked = Array.isArray(c.picks && c.picks[set.id]) ? c.picks[set.id] : [];
    let names = [...new Set(asked.filter((n) => set.choices.some((x) => x.name === n)))];
    names = names.slice(0, set.kind === "one" ? 1 : set.max || set.choices.length);
    if (!names.length && set.required) names = [set.choices[0].name];
    if (names.length) picks[set.id] = names;
  }
  return { size, picks };
}

/** The price of one, in cents, with the size and choices: the size's price plus what each choice adds. Null for an item that only has a price range. */
export function unitCents(item, custom) {
  if (!item || item.cents == null) return null;
  const r = resolve(item, custom);
  let cents = r.size ? item.sizes.find((s) => s.name === r.size).cents : item.cents;
  for (const set of item.optionSets || []) for (const n of r.picks[set.id] || []) cents += set.choices.find((x) => x.name === n).cents;
  return cents;
}

/** What the choices add on top of the size's own price, in cents. */
export function extrasCents(item, custom) {
  const unit = unitCents(item, custom);
  if (unit == null) return 0;
  const r = resolve(item, custom);
  return unit - (r.size ? item.sizes.find((s) => s.name === r.size).cents : item.cents);
}

/** "Large, Iced, Oat milk, Vanilla, Caramel": what the customer asked for, in the menu's order. Empty for an item with nothing to choose. */
export function describeCustom(item, custom) {
  const r = resolve(item, custom), parts = [];
  if (r.size && item.sizes.length > 1) parts.push(r.size);
  for (const set of item.optionSets || []) parts.push(...(r.picks[set.id] || []));
  return parts.join(", ");
}

/** The choice to send with an order: { size?, picks? }. The server prices it again from its own menu. */
export function orderChoice(item, custom) {
  const r = resolve(item, custom), out = {};
  if (r.size) out.size = r.size;
  if (Object.keys(r.picks).length) out.picks = r.picks;
  return out;
}

export const setSize = (custom, name) => ({ ...EMPTY, ...custom, size: name });

/**
 * Tap a choice. In a "choose one" set a different choice replaces the old one, and tapping the chosen one again clears it (unless the set is required).
 * In a "choose any" set it turns that choice on or off, up to the set's limit. Returns the new custom.
 */
export function togglePick(item, custom, setId, name) {
  const set = (item.optionSets || []).find((s) => s.id === setId);
  if (!set || !set.choices.some((c) => c.name === name)) return custom;
  const now = resolve(item, custom).picks[setId] || [];
  let next;
  if (set.kind === "one") next = now.includes(name) ? (set.required ? now : []) : [name];
  else if (now.includes(name)) next = now.filter((n) => n !== name);
  else if (now.length >= (set.max || set.choices.length)) next = now;
  else next = [...now, name];
  return { ...EMPTY, ...custom, picks: { ...(custom && custom.picks), [setId]: next } };
}
