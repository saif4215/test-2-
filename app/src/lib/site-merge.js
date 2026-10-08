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
  if (list(remote.faq)) out.faq = remote.faq.filter((f) => f && f.q && f.a);
  if (list(remote.packages)) out.packages = remote.packages.filter((p) => p && p.title).map((p) => ({ ...p, includes: Array.isArray(p.includes) ? p.includes : [] }));
  if (text(remote.packagesNote) !== null) out.packagesNote = remote.packagesNote;
  if (remote.venue && typeof remote.venue === "object") out.venue = { ...BLANK_VENUE, ...Object.fromEntries(Object.entries(remote.venue).filter(([, v]) => typeof v === "string")) };
  if (Array.isArray(remote.gallery)) out.gallery = remote.gallery.filter((g) => g && g.url && g.alt).map((g) => ({ url: absolute(g.url, apiUrl), alt: g.alt, caption: g.caption || "" }));
  if (Array.isArray(remote.reviews)) out.reviews = remote.reviews.filter((r) => r && r.name && r.text);
  if (remote.photos && typeof remote.photos === "object") out.photos = Object.fromEntries(Object.entries(remote.photos).filter(([, u]) => typeof u === "string" && u).map(([k, u]) => [k, absolute(u, apiUrl)]));
  const menu = remote.menu;
  if (menu && typeof menu === "object" && menu.groups && typeof menu.groups === "object" && Object.keys(menu.groups).length) out.menu = menu;
  return out;
}

/** id -> item, for every item on a menu. */
export function indexMenu(menu) {
  const map = new Map();
  for (const [group, cats] of Object.entries(menu.groups)) for (const [cat, items] of Object.entries(cats)) for (const it of items) map.set(it.id, { ...it, group, cat });
  return map;
}
