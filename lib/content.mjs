// Editable site content: contact details, hours, event options, FAQ, reviews, gallery and photo slots.
// Everything is cleaned field by field, so nothing unexpected is stored or shown.

const str = (v, max) => (typeof v === "string" ? v.trim().replace(/[ \t]+/g, " ").slice(0, max) : "");
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

/** Only our own uploads or https links may be used for pictures and links. */
export const safeUrl = (v) => { const s = str(v, 400); return /^\/uploads\/[A-Za-z0-9._-]+$/.test(s) || /^https:\/\/[^\s<>"']+$/i.test(s) ? s : ""; };
const safeLink = (v) => { const s = str(v, 400); return /^https:\/\/[^\s<>"']+$/i.test(s) ? s : ""; };

export const SLOTS = ["hero", "largeOrders", "catering", "interior", "interior2", "event"];

export function normalizeContent(input) {
  const errors = [], c = input && typeof input === "object" ? input : {};
  const out = {};

  const b = c.business || {};
  const phone = str(b.phone, 30), phoneTel = str(b.phoneTel, 20).replace(/[^\d+]/g, "");
  if (phone && !/^[\d\s().+-]{7,30}$/.test(phone)) errors.push("The phone number should have digits only.");
  const email = str(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("The email address does not look right.");
  const hours = list(b.hours, 14).map((h) => ({ label: str(h?.label, 40), days: list(h?.days, 7).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6), open: Number(h?.open), close: Number(h?.close) }));
  for (const h of hours) if (!h.label || !h.days.length || !(h.open >= 0 && h.open <= 24 && h.close > h.open && h.close <= 24)) errors.push(`The hours "${h.label || "(no label)"}" are not valid. Use hours from 0 to 24, with closing after opening.`);
  out.business = {
    phone, phoneTel: phoneTel || phone.replace(/[^\d+]/g, ""), email,
    address: list(b.address, 3).map((l) => str(l, 100)).filter(Boolean),
    hours,
    instagram: safeLink(b.instagram), tiktok: safeLink(b.tiktok), reviewsUrl: safeLink(b.reviewsUrl),
  };

  const v = c.venue || {};   // blank unless the owner fills it in: nothing here is invented
  out.venue = { capacity: str(v.capacity, 80), notes: text(v.notes, 1000), policies: text(v.policies, 1500) };

  out.faq = list(c.faq, 30).map((f) => ({ q: str(f?.q, 200), a: text(f?.a, 1500) })).filter((f) => f.q && f.a);
  out.packages = list(c.packages, 8).map((p, i) => ({
    id: str(p?.id, 60) || str(p?.title, 60) || `option-${i + 1}`, title: str(p?.title, 60), blurb: str(p?.blurb, 200),
    includes: list(p?.includes, 12).map((x) => str(x, 120)).filter(Boolean), price: str(p?.price, 60),
  })).filter((p) => p.title);
  out.packagesNote = text(c.packagesNote, 500);

  out.gallery = list(c.gallery, 40).map((g) => ({ url: safeUrl(g?.url), alt: str(g?.alt, 160), caption: str(g?.caption, 160) })).filter((g) => g.url);
  for (const g of out.gallery) if (!g.alt) errors.push("Every gallery photo needs a short description (for screen readers and search engines).");
  out.reviews = list(c.reviews, 30).map((r) => ({ name: str(r?.name, 60), source: str(r?.source, 60), date: str(r?.date, 20), text: text(r?.text, 1200), url: safeLink(r?.url) })).filter((r) => r.name && r.text);

  out.photos = {};
  for (const slot of SLOTS) { const u = safeUrl(c.photos?.[slot]); if (u) out.photos[slot] = u; }
  return { content: errors.length ? null : out, errors: [...new Set(errors)] };
}

/** Override values replace the defaults key by key, so a half-filled override never blanks the whole site. */
export function mergeContent(defaults, override) {
  if (!override) return defaults;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(override)) {
    if (k === "business") out.business = { ...defaults.business, ...Object.fromEntries(Object.entries(v).filter(([, x]) => !(Array.isArray(x) ? x.length === 0 : x === ""))) };
    else out[k] = v;
  }
  return out;
}
