// Sizes and choices on a menu item ("Small $3.00 / Large $3.50", "Oat milk +$1", "Hot or Regular"), and the price they add up to.
// The server is the only place a price is decided: the app sends which size and which choices, and the server looks up what each one costs.
//
// In the menu:
//   optionGroups: { milk: { label: "Milk", kind: "one", choices: [{ name: "Oat milk", cents: 100 }] }, ... }
//   an item:      { id, name, cents, sizes?: [{ name: "Small", cents: 300 }, { name: "Large", cents: 350 }], options?: ["milk", "syrup"] }
// `cents` of an item with sizes is always its first (smallest) size, so anything that only knows `cents` still works.

const GROUP_ID = /^[a-z][a-z0-9-]{0,30}$/;
const str = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const money = (n) => Number.isInteger(n) && n >= 0 && n <= 1000000;

/** Check and clean the option groups an owner submitted. Returns { groups, errors }. */
export function normalizeOptionGroups(input) {
  const groups = {}, errors = [];
  if (input == null) return { groups, errors };
  if (typeof input !== "object" || Array.isArray(input)) return { groups, errors: ["The choices are not in the right form."] };
  for (const [id, raw] of Object.entries(input).slice(0, 40)) {
    if (!GROUP_ID.test(id) || !raw || typeof raw !== "object") { errors.push(`A set of choices has an invalid name (${str(id, 30)}).`); continue; }
    const label = str(raw.label, 40);
    if (!label) { errors.push(`The choices "${id}" need a label.`); continue; }
    const kind = raw.kind === "many" ? "many" : "one";
    const seen = new Set(), choices = [];
    for (const c of Array.isArray(raw.choices) ? raw.choices.slice(0, 30) : []) {
      const name = str(c?.name, 40), cents = c?.cents == null ? 0 : c.cents;
      if (!name) { errors.push(`A choice in "${label}" has no name.`); continue; }
      if (!money(cents)) { errors.push(`"${name}" in "${label}" needs a price like 0.50.`); continue; }
      if (seen.has(name.toLowerCase())) { errors.push(`"${name}" is listed twice in "${label}".`); continue; }
      seen.add(name.toLowerCase());
      choices.push({ name, cents });
    }
    if (!choices.length) { errors.push(`"${label}" has no choices.`); continue; }
    const group = { label, kind, choices };
    if (kind === "one" && raw.required === true) group.required = true;
    if (kind === "many") { const m = Number(raw.max); group.max = Number.isInteger(m) && m >= 1 ? Math.min(m, choices.length) : choices.length; }
    groups[id] = group;
  }
  return { groups, errors };
}

/** Check an item's sizes: [{ name, cents }], one or more, each name once. Returns { sizes, errors } (sizes is null when the item has none). */
export function normalizeSizes(input, itemName) {
  if (input == null) return { sizes: null, errors: [] };
  const errors = [], sizes = [], seen = new Set();
  for (const s of Array.isArray(input) ? input.slice(0, 8) : []) {
    const name = str(s?.name, 24);
    if (!name || !money(s?.cents)) { errors.push(`"${itemName}" has a size without a name or price.`); continue; }
    if (seen.has(name.toLowerCase())) { errors.push(`"${itemName}" lists the size ${name} twice.`); continue; }
    seen.add(name.toLowerCase());
    sizes.push({ name, cents: s.cents });
  }
  if (!sizes.length && !errors.length) errors.push(`"${itemName}" has an empty list of sizes.`);
  return { sizes: sizes.length ? sizes : null, errors };
}

export class ChoiceError extends Error {}

/**
 * The price and the words for one line, from what the customer picked.
 *   entry: { name, cents, sizes?, groups?: [{ id, label, kind, required?, max?, choices: [{ name, cents }] }] }   (see checkoutIndex)
 *   input: { size?, picks?: { groupId: [choice names] } }
 * A size or choice that does not exist (the café changed its menu since the customer chose) throws ChoiceError.
 * Returns { cents, name, text, sig }: `name` is what goes on the order ("Latte (Large)"), `text` is for whoever makes it, `sig` tells two identical lines apart.
 */
export function priceChoice(entry, input = {}) {
  const sizes = entry.sizes || [], groups = entry.groups || [];
  let cents = entry.cents, size = "";
  if (sizes.length) {
    size = input.size == null || input.size === "" ? sizes[0].name : String(input.size);
    const s = sizes.find((x) => x.name === size);
    if (!s) throw new ChoiceError(`${entry.name} doesn't come in ${size}.`);
    cents = s.cents;
  } else if (input.size) throw new ChoiceError(`${entry.name} doesn't come in sizes.`);

  const picks = input.picks && typeof input.picks === "object" && !Array.isArray(input.picks) ? input.picks : {};
  for (const gid of Object.keys(picks)) if (!groups.some((g) => g.id === gid) && picks[gid]?.length) throw new ChoiceError(`${entry.name} doesn't have that choice.`);
  const parts = [], chosen = [];
  for (const g of groups) {
    let names = Array.isArray(picks[g.id]) ? [...new Set(picks[g.id].map(String))] : [];
    if (g.kind === "one" && names.length > 1) throw new ChoiceError(`Choose only one for ${g.label}.`);
    if (g.kind === "many" && names.length > (g.max || g.choices.length)) throw new ChoiceError(`Too many choices for ${g.label}.`);
    if (!names.length && g.required) names = [g.choices[0].name];
    if (!names.length) continue;
    const found = names.map((n) => g.choices.find((c) => c.name === n));
    if (found.some((c) => !c)) throw new ChoiceError(`${g.label} has a choice that isn't on the menu any more.`);
    cents += found.reduce((s, c) => s + c.cents, 0);
    parts.push(`${g.label}: ${found.map((c) => c.name).join(", ")}`);
    chosen.push([g.id, found.map((c) => c.name)]);
  }
  return { cents, name: size ? `${entry.name} (${size})` : entry.name, text: parts.join("; "), sig: JSON.stringify([size, chosen]) };
}

const fmt = (c) => `$${(c / 100).toFixed(2)}`;

/** How a menu shows an item's price: "$4.50", "Small $4.50 / Large $5.50", or "$3.00-$4.00" for an item that only has a range. */
export function priceLabel(item) {
  if (item.sizes && item.sizes.length > 1) return item.sizes.map((s) => `${s.name} ${fmt(s.cents)}`).join(" / ");
  return item.cents != null ? fmt(item.cents) : `${fmt(item.min)}-${fmt(item.max)}`;
}

/** The choices and extras as lines for the chat and the AI: what each set is, what it adds, and where it is offered. */
export function choicesLines(menu) {
  const groups = menu.optionGroups || {}, out = [];
  for (const [id, g] of Object.entries(groups)) {
    const where = [];
    for (const cats of Object.values(menu.groups || {})) for (const [cat, list] of Object.entries(cats)) {
      const shown = list.filter((i) => !i.hidden), has = shown.filter((i) => (i.options || []).includes(id));
      if (!has.length) continue;
      where.push(has.length === shown.length ? `every item in ${cat}` : has.map((i) => i.name).join(", "));
    }
    if (!where.length) continue;
    const prices = [...new Set(g.choices.map((c) => c.cents))];
    const cost = prices.length === 1 ? (prices[0] > 0 ? ` (+${fmt(prices[0])} each)` : " (free)") : "";
    const names = g.choices.map((c) => (prices.length === 1 ? c.name : `${c.name}${c.cents > 0 ? ` +${fmt(c.cents)}` : ""}`)).join(", ");
    out.push(`${g.label} [set id: ${id}]${cost}: ${names}. ${g.kind === "many" ? "Choose any" : g.required ? "Choose one (required)" : "Choose one"}. Offered on: ${where.join("; ")}.`);
  }
  return out;
}
