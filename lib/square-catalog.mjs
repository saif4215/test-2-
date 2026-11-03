// Reading the café's item list from Square (read only), so the chat can use what the café wrote there.
// Square's catalog is NOT used for ordering: the app orders from its own menu, so the price a customer is shown is the price they are charged.
// Where Square and the app menu disagree on a price, the chat does not state either one (it sends the customer to the phone) and the dashboard lists it.
const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

/** The café's items from one or more pages of Square's catalog list: [{ name, description, category, prices: [cents] }]. Archived, deleted and other-location items are left out. */
export function parseCatalog(pages, locationId) {
  const objects = pages.flatMap((p) => (Array.isArray(p?.objects) ? p.objects : []));
  const categories = new Map(objects.filter((o) => o.type === "CATEGORY").map((o) => [o.id, clip(o.category_data?.name, 80)]));
  const items = [];
  for (const o of objects) {
    if (o.type !== "ITEM" || o.is_deleted || o.item_data?.is_archived) continue;
    if (o.present_at_all_locations === false && !(o.present_at_location_ids || []).includes(locationId)) continue;
    if ((o.absent_at_location_ids || []).includes(locationId)) continue;
    const d = o.item_data || {}, name = clip(d.name, 120);
    if (!name) continue;
    const prices = (d.variations || []).map((v) => v.item_variation_data?.price_money?.amount).filter((n) => Number.isInteger(n) && n >= 0);
    const catId = d.category_id || d.categories?.[0]?.id;
    items.push({ name, description: clip(d.description_plaintext || d.description, 400), category: categories.get(catId) || "", prices: [...new Set(prices)].sort((a, b) => a - b) });
  }
  return items;
}

/** Fetch every page (at most 6) of the item list. Throws if Square cannot be reached or refuses. */
export async function fetchCatalog(apiBase, token, version, locationId) {
  const pages = [];
  let cursor = "";
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${apiBase}/v2/catalog/list?types=ITEM,CATEGORY${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, {
      headers: { Authorization: `Bearer ${token}`, "Square-Version": version }, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Square catalog answered ${res.status}`);
    const json = await res.json();
    pages.push(json);
    cursor = typeof json.cursor === "string" ? json.cursor : "";
    if (!cursor) break;
  }
  return parseCatalog(pages, locationId);
}

const priceMatches = (appItem, squarePrices) => {
  if (!squarePrices.length) return true;   // Square has no price to disagree with
  const app = appItem.cents != null ? [appItem.cents] : [appItem.min, appItem.max];
  return appItem.cents != null ? squarePrices.includes(appItem.cents) : squarePrices.every((p) => p >= app[0] && p <= app[1]);
};

/**
 * Line the app menu up with Square by item name. Returns:
 *  byName: Map of normalized name -> { description, differ } for the chat (differ: the prices do not agree),
 *  report: what to show in the dashboard { items, matched, differ: [{ name, app, square }], onlyInSquare: [names], onlyInApp: [names] }.
 */
export function compareMenus(squareItems, menu) {
  const app = [];
  for (const cats of Object.values(menu.groups || {})) for (const list of Object.values(cats)) for (const i of list) if (!i.hidden) app.push(i);
  const sq = new Map(squareItems.map((s) => [norm(s.name), s]));
  const byName = new Map(), differ = [], onlyInApp = [];
  let matched = 0;
  for (const a of app) {
    const s = sq.get(norm(a.name));
    if (!s) { onlyInApp.push(a.name); continue; }
    matched++;
    const bad = !priceMatches(a, s.prices);
    byName.set(norm(a.name), { description: s.description, differ: bad });
    if (bad) differ.push({ name: a.name, app: a.cents ?? [a.min, a.max], square: s.prices });
  }
  const appNames = new Set(app.map((a) => norm(a.name)));
  const onlyInSquare = squareItems.filter((s) => !appNames.has(norm(s.name))).map((s) => s.name);
  return { byName, report: { items: squareItems.length, matched, differ: differ.slice(0, 30), onlyInSquare: onlyInSquare.slice(0, 30), onlyInApp: onlyInApp.slice(0, 30) } };
}

export { norm as normalizeName };
