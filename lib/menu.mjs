// The menu: validation of what the owner edits, and the lookups the checkout and the apps use.

const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const str = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/**
 * Check and clean a menu the owner submitted. Returns { menu, errors }.
 * Shape: { currency, groups: { Group: { Category: [ { id, name, cents | min+max, desc?, hidden? } ] } } }
 */
export function normalizeMenu(input) {
  const errors = [];
  const menu = { currency: "USD", groups: {} };
  if (!input || typeof input !== "object" || typeof input.groups !== "object" || !input.groups) return { menu: null, errors: ["The menu is missing its groups."] };
  const seen = new Set();
  let total = 0;
  for (const [gname, cats] of Object.entries(input.groups)) {
    const g = str(gname, 40);
    if (!g) { errors.push("A group has no name."); continue; }
    menu.groups[g] = {};
    for (const [cname, items] of Object.entries(cats || {})) {
      const c = str(cname, 40);
      if (!c) { errors.push(`A category in ${g} has no name.`); continue; }
      if (!Array.isArray(items)) { errors.push(`${c} must be a list of items.`); continue; }
      menu.groups[g][c] = [];
      for (const raw of items) {
        if (++total > 600) { errors.push("The menu is too large (600 items at most)."); break; }
        const name = str(raw?.name, 80);
        if (!name) { errors.push(`An item in ${c} has no name.`); continue; }
        let id = typeof raw.id === "string" && ID.test(raw.id) ? raw.id : `${slug(g)}-${slug(c)}-${slug(name)}`;
        if (!ID.test(id)) { errors.push(`"${name}" has an invalid id.`); continue; }
        while (seen.has(id)) id += "-2";
        seen.add(id);
        const item = { id, name };
        const cents = raw.cents, min = raw.min, max = raw.max;
        const money = (n) => Number.isInteger(n) && n >= 0 && n <= 10000000;
        if (money(cents) && min == null && max == null) item.cents = cents;
        else if (money(min) && money(max) && min <= max) { item.min = min; item.max = max; }
        else { errors.push(`"${name}" needs a valid price (a single price, or a low and high price).`); continue; }
        const desc = str(raw.desc, 300);
        if (desc) item.desc = desc;
        if (raw.hidden === true) item.hidden = true;
        if (raw.featured === true && raw.hidden !== true) item.featured = true;   // shown in the app's home picks
        menu.groups[g][c].push(item);
      }
    }
  }
  if (!Object.keys(menu.groups).length) errors.push("The menu has no groups.");
  return { menu: errors.length ? null : menu, errors };
}

/** What customers see: hidden items removed, and no empty categories. */
export function publicMenu(menu) {
  const out = { currency: menu.currency || "USD", groups: {} };
  for (const [g, cats] of Object.entries(menu.groups)) {
    for (const [c, items] of Object.entries(cats)) {
      const shown = items.filter((i) => !i.hidden).map(({ hidden, ...rest }) => rest);
      if (shown.length) (out.groups[g] ||= {})[c] = shown;
    }
  }
  return out;
}

/** id -> { name, cents } for items that can be paid for online: one fixed price, and not hidden. */
export function checkoutIndex(menu) {
  const index = new Map();
  for (const cats of Object.values(menu.groups)) for (const items of Object.values(cats)) for (const it of items) if (!it.hidden && Number.isInteger(it.cents)) index.set(it.id, { name: it.name, cents: it.cents });
  return index;
}
