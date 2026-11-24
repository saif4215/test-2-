// Combines what is built into the app with what the café has edited in the dashboard.
// Pure data in, pure data out (so it is tested without a phone). Anything missing or malformed on the
// server side falls back to what the app already has: a bad answer never blanks the screen.

const text = (v) => (typeof v === "string" ? v : null);
const list = (v) => (Array.isArray(v) && v.length ? v : null);

export const BLANK_VENUE = { capacity: "", notes: "", policies: "" };

/** Make /uploads/... paths absolute so the phone can load them from the café's server. */
export const absolute = (url, apiUrl) => (typeof url === "string" ? (url.startsWith("/") ? `${apiUrl}${url}` : url) : "");

export function mergeSite(base, remote, apiUrl = "") {
  if (!remote || typeof remote !== "object") return base;
  const out = { ...base };
  const rb = remote.business && typeof remote.business === "object" ? remote.business : {};
  out.business = { ...base.business };
  for (const k of ["phone", "phoneTel"]) if (text(rb[k])) out.business[k] = rb[k];
  for (const k of ["email", "instagram", "tiktok"]) if (text(rb[k]) !== null) out.business[k] = rb[k];   // blank means the café removed it
  if (list(rb.address) && rb.address.every((l) => typeof l === "string")) out.business.address = rb.address;
  const hours = list(rb.hours);
  if (hours && hours.every((h) => Array.isArray(h?.days) && Number.isFinite(h.open) && Number.isFinite(h.close))) out.business.hours = hours;
  if (text(rb.reviewsUrl) !== null) out.business.reviewsUrl = rb.reviewsUrl;
  if (text(rb.badge) !== null) out.business.badge = rb.badge.trim();   // blank means the café removed it
  if (list(remote.faq)) out.faq = remote.faq.filter((f) => f && f.q && f.a);
  if (list(remote.packages)) out.packages = remote.packages.filter((p) => p && p.title).map((p) => ({ ...p, includes: Array.isArray(p.includes) ? p.includes : [] }));
  if (text(remote.packagesNote) !== null) out.packagesNote = remote.packagesNote;
  if (text(remote.featuredTitle)) out.featuredTitle = remote.featuredTitle;
  if (Array.isArray(remote.amenities)) out.amenities = remote.amenities.filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim().slice(0, 40)).slice(0, 12);
  if (Array.isArray(remote.promotions)) out.promotions = remote.promotions.filter((p) => p && typeof p.title === "string" && p.title).map((p) => ({ title: p.title, text: typeof p.text === "string" ? p.text : "", until: typeof p.until === "string" ? p.until : "" }));
  if (Array.isArray(remote.rewards)) out.rewards = remote.rewards.filter((r) => r && typeof r.title === "string" && r.title && Number.isFinite(Number(r.points)) && Number(r.points) >= 1).map((r) => ({ title: r.title, points: Math.floor(Number(r.points)) })).sort((a, b) => a.points - b.points);
  if (text(remote.rewardsNote) !== null) out.rewardsNote = remote.rewardsNote;
  if (typeof remote.birthdayTreat === "string") out.birthdayTreat = remote.birthdayTreat.trim().slice(0, 100);
  if (remote.venue && typeof remote.venue === "object") out.venue = { ...BLANK_VENUE, ...Object.fromEntries(Object.entries(remote.venue).filter(([, v]) => typeof v === "string")) };
  if (Array.isArray(remote.gallery)) out.gallery = remote.gallery.filter((g) => g && g.url && g.alt).map((g) => ({ url: absolute(g.url, apiUrl), alt: g.alt, caption: g.caption || "" }));
  if (Array.isArray(remote.reviews)) out.reviews = remote.reviews.filter((r) => r && r.name && r.text);
  if (remote.photos && typeof remote.photos === "object") out.photos = Object.fromEntries(Object.entries(remote.photos).filter(([, u]) => typeof u === "string" && u).map(([k, u]) => [k, absolute(u, apiUrl)]));
  const menu = remote.menu;
  if (menu && typeof menu === "object" && menu.groups && typeof menu.groups === "object" && Object.keys(menu.groups).length) out.menu = withImageUrls(menu, apiUrl);
  return out;
}

/** Make item pictures that point at the café's own uploads absolute, so the phone can load them, and remember each item's category (used to pick a built-in picture). */
export function withImageUrls(menu, apiUrl) {
  return { ...menu, groups: Object.fromEntries(Object.entries(menu.groups).map(([g, cats]) => [g, Object.fromEntries(Object.entries(cats).map(([c, items]) => [c, items.map((it) => ({ ...it, cat: c, ...(typeof it.image === "string" && it.image ? { image: absolute(it.image, apiUrl) } : {}) }))]))])) };
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Items whose name, description or category contain every word typed. Items whose own name matches come first. categories = [{ name, items }] */
export function searchMenu(categories, query) {
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const byName = [], rest = [];
  for (const c of categories) for (const it of c.items) {
    const hay = norm(`${it.name} ${it.desc || ""} ${c.name}`);
    if (!words.every((w) => hay.includes(w))) continue;
    (words.every((w) => norm(it.name).includes(w)) ? byName : rest).push({ ...it, _cat: c.name });
  }
  return [...byName, ...rest];
}

/** id -> item, for every item on a menu. An item that offers choices also carries `optionSets`: the menu's option groups it uses, each with its id. */
export function indexMenu(menu) {
  const map = new Map();
  const setsOf = (it) => (Array.isArray(it.options) ? it.options.filter((id) => menu.optionGroups && menu.optionGroups[id]).map((id) => ({ id, ...menu.optionGroups[id] })) : []);
  for (const [group, cats] of Object.entries(menu.groups)) for (const [cat, items] of Object.entries(cats)) for (const it of items) {
    const optionSets = setsOf(it);
    map.set(it.id, { ...it, group, cat, ...(optionSets.length ? { optionSets } : {}) });
  }
  return map;
}

/** The dietary tags the café has put on at least one shown item, in the usual order (none until the café ticks some). */
export const DIET_ORDER = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free"];
export function dietsPresent(menu) {
  const found = new Set();
  for (const cats of Object.values((menu && menu.groups) || {})) for (const items of Object.values(cats)) for (const it of items) if (!it.hidden && Array.isArray(it.diet)) for (const d of it.diet) found.add(d);
  return DIET_ORDER.filter((d) => found.has(d));
}

/** Keep only the items with a tag, and only the categories that still have items. categories = [{ name, group, items }]. No tag chosen: everything stays. */
export function filterByDiet(categories, tag) {
  if (!tag) return categories;
  return categories.map((c) => ({ ...c, items: c.items.filter((it) => Array.isArray(it.diet) && it.diet.includes(tag)) })).filter((c) => c.items.length);
}

/** The small line under an item's price: the dietary tags the café ticked. Empty when it ticked none. */
export const itemFacts = (it) => ((it && Array.isArray(it.diet)) ? it.diet : []).filter(Boolean).join(" · ");

/**
 * "Picked for you": things this customer has not tried yet, from the categories they order from most. Worked out on their own phone from their own past orders:
 * nothing is sent anywhere. Items the café labelled New or Seasonal, or put on Home, are tried first inside a category. Nothing until they have ordered.
 * history = [{ lines: [{ id }] }], newest first.
 */
export function pickedForYou(menu, history, max = 6) {
  const byId = indexMenu(menu || { groups: {} });
  const tried = new Set(), perCat = new Map();
  for (const order of Array.isArray(history) ? history : []) for (const l of (order && order.lines) || []) {
    const it = byId.get(l.id); if (!it) continue;
    tried.add(it.id);
    perCat.set(`${it.group}|${it.cat}`, (perCat.get(`${it.group}|${it.cat}`) || 0) + (Number(l.qty) || 1));
  }
  if (!tried.size) return [];
  const cats = [...perCat.entries()].sort((a, b) => b[1] - a[1]);   // the most ordered category first
  const pools = [];
  for (const [key] of cats) {
    const [group, cat] = key.split("|");
    const fresh = [...byId.values()].filter((it) => it.group === group && it.cat === cat && !it.hidden && !tried.has(it.id) && it.cents != null);
    fresh.sort((a, b) => ((b.badge === "New" || b.badge === "Seasonal" ? 2 : 0) + (b.featured ? 1 : 0)) - ((a.badge === "New" || a.badge === "Seasonal" ? 2 : 0) + (a.featured ? 1 : 0)));   // stable: the rest keep the café's order
    if (fresh.length) pools.push(fresh);
  }
  const out = [];
  for (let round = 0; out.length < max; round++) {
    let added = false;
    for (const pool of pools) if (out.length < max && pool[round]) { out.push(pool[round]); added = true; }
    if (!added) break;
  }
  return out;
}

/** Items the café labelled New or Seasonal, for the "What's new" row on Home (up to `max`, New first, menu order inside each). Hidden items never show. Nothing until the café labels one. */
export function newItems(menu, max = 8) {
  const fresh = [], seasonal = [];
  for (const [group, cats] of Object.entries((menu && menu.groups) || {})) for (const [cat, items] of Object.entries(cats)) for (const it of items) {
    if (it.hidden) continue;
    if (it.badge === "New") fresh.push({ ...it, group, cat });
    else if (it.badge === "Seasonal") seasonal.push({ ...it, group, cat });
  }
  return [...fresh, ...seasonal].slice(0, max);
}

/** The items the café picked for the home screen (up to 4), in menu order. Hidden items never appear. */
export function featuredItems(menu, max = 4) {
  const out = [];
  for (const [group, cats] of Object.entries(menu.groups)) for (const [cat, items] of Object.entries(cats)) for (const it of items) if (it.featured && !it.hidden && out.length < max) out.push({ ...it, group, cat });
  return out;
}

/**
 * "Add something else": up to `max` items to offer next to an item or an order. Items from the other half of the menu come first
 * (a drink is offered food, food is offered drinks), one from each category in turn so there is variety, then other categories of the same half.
 * Items the café picked come first inside a category. Hidden items, the item itself and anything already in the order are left out.
 */
export function suggestFor(menu, item, have = [], max = 6) {
  const pools = [];
  for (const [group, cats] of Object.entries(menu.groups)) for (const [cat, items] of Object.entries(cats)) {
    const ok = items.filter((it) => !it.hidden && it.id !== item.id && !have.includes(it.id)).map((it) => ({ ...it, group, cat }));
    ok.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));   // stable: the rest keep the café's order
    if (ok.length) pools.push({ group, cat, items: ok });
  }
  const out = [];
  for (const pool of [pools.filter((p) => p.group !== item.group), pools.filter((p) => p.group === item.group && p.cat !== item.cat)]) {
    for (let round = 0; out.length < max; round++) {
      let added = false;
      for (const p of pool) if (out.length < max && p.items[round]) { out.push(p.items[round]); added = true; }
      if (!added) break;
    }
  }
  return out;
}
