// Fills the public pages with the owner's real details (from the dashboard) before they are sent:
// contact info, hours, FAQ, reviews, gallery, photos and the search-engine data (JSON-LD).
// Nothing here is invented: a section with nothing to show is left out completely.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function fmtHour(h) {
  const whole = Math.floor(h) % 24, mins = Math.round((h - Math.floor(h)) * 60);
  return `${whole % 12 || 12}${mins ? `:${String(mins).padStart(2, "0")}` : ""} ${whole < 12 ? "AM" : "PM"}`;
}
const clock = (h) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

const PHOTO_ALT = { hero: "Maruf Cafe", largeOrders: "Food for a large order from Maruf Cafe", catering: "Catering from Maruf Cafe", interior: "Inside Maruf Cafe", interior2: "Inside Maruf Cafe", event: "An event space at Maruf Cafe" };

function address(c) {
  const lines = c.business.address;
  const m = /^(.+?),\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/.exec(lines[1] || "");
  return { lines, street: lines[0] || "", city: m ? m[1] : "", state: m ? m[2].toUpperCase() : "", zip: m ? m[3] : "" };
}

function localBusiness(c, base) {
  const b = c.business, a = address(c);
  const ld = { "@context": "https://schema.org", "@type": "CafeOrCoffeeShop", name: "Maruf Cafe" };
  if (base) { ld.url = `${base}/`; ld.image = `${base}/og-image.png`; }
  if (b.phone) ld.telephone = b.phoneTel || b.phone;
  if (b.email) ld.email = b.email;
  if (a.street && a.city) ld.address = { "@type": "PostalAddress", streetAddress: a.street, addressLocality: a.city, addressRegion: a.state, postalCode: a.zip, addressCountry: "US" };
  if (b.hours.length) ld.openingHoursSpecification = b.hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days.map((d) => DAYS[d]), opens: clock(h.open), closes: clock(h.close) }));
  const same = [b.instagram, b.tiktok].filter(Boolean);
  if (same.length) ld.sameAs = same;
  // Real, owner-entered reviews only. No star rating is ever made up.
  if (c.reviews.length) ld.review = c.reviews.map((r) => ({ "@type": "Review", author: { "@type": "Person", name: r.name }, reviewBody: r.text, ...(r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? { datePublished: r.date } : {}) }));
  return ld;
}

const faqHtml = (c) => c.faq.length ? `<div class="faq">${c.faq.map((f) => `<details class="reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a).replace(/\n/g, "<br>")}</p></details>`).join("")}</div>` : "";
const reviewsHtml = (c) => c.reviews.length ? `<section id="reviews" class="section"><p class="eyebrow reveal">Reviews</p><h2 class="reveal">What customers <em>say.</em></h2><div class="reviews">${c.reviews.map((r) => `<figure class="review reveal"><blockquote>${esc(r.text)}</blockquote><figcaption>${esc(r.name)}${r.source ? `, ${esc(r.source)}` : ""}${r.date ? ` <time>${esc(r.date)}</time>` : ""}${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener">Read it</a>` : ""}</figcaption></figure>`).join("")}</div>${c.business.reviewsUrl ? `<p class="cta-row"><a class="btn ghost" href="${esc(c.business.reviewsUrl)}" target="_blank" rel="noopener">See all reviews</a></p>` : ""}</section>` : "";
const galleryHtml = (c) => c.gallery.length ? `<section id="gallery" class="section"><p class="eyebrow reveal">Gallery</p><h2 class="reveal">Take a <em>look.</em></h2><div class="gallery">${c.gallery.map((g) => `<figure class="reveal"><img src="${esc(g.url)}" alt="${esc(g.alt)}" loading="lazy" decoding="async">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`).join("")}</div></section>` : "";
const packagesHtml = (c) => c.packages.length ? `<div class="packages">${c.packages.map((p) => `<article class="package reveal"><h3>${esc(p.title)}</h3>${p.blurb ? `<p>${esc(p.blurb)}</p>` : ""}${p.includes.length ? `<ul>${p.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}${p.price ? `<p class="price">${esc(p.price)}</p>` : ""}<a class="btn ghost" href="/rent-the-cafe#request" data-package="${esc(p.title)}">Ask about this</a></article>`).join("")}</div>${c.packagesNote ? `<p class="note reveal">${esc(c.packagesNote)}</p>` : ""}` : "";
const venueHtml = (c) => {
  const v = c.venue, rows = [v.capacity && ["Capacity", v.capacity], v.notes && ["About the space", v.notes], v.policies && ["Policies", v.policies]].filter(Boolean);
  return rows.length ? `<dl class="venue-facts reveal">${rows.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x).replace(/\n/g, "<br>")}</dd>`).join("")}</dl>` : "";
};
const photoHtml = (c, slot) => c.photos[slot] ? `<figure class="slot-photo slot-${esc(slot)}"><img src="${esc(c.photos[slot])}" alt="${esc(PHOTO_ALT[slot] || "Maruf Cafe")}" loading="lazy" decoding="async"></figure>` : "";

/** Fill a page. `page` is for the marker comments, `base` is the public web address (no trailing slash) or "". */
export function renderPage(html, c, { base = "", path = "/" } = {}) {
  const b = c.business, a = address(c);
  const hoursHtml = b.hours.map((h) => `<li data-days="${h.days.join(",")}" data-open="${h.open}" data-close="${h.close}"><span>${esc(h.label)}</span><span>${fmtHour(h.open)} – ${fmtHour(h.close)}</span></li>`).join("");
  const maps = a.lines.length ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.lines.join(" "))}` : "";
  const tokens = {
    phone: esc(b.phone), phoneTel: esc(b.phoneTel), email: esc(b.email),
    emailLink: b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : "[ADD EMAIL]",
    addressHtml: a.lines.map(esc).join("<br>"), addressLine: esc(a.lines.join(", ")), mapsUrl: esc(maps), hoursHtml, instagram: esc(b.instagram), tiktok: esc(b.tiktok),
  };
  const ld = [];
  if (html.includes("<!--HEAD-->")) {
    ld.push(localBusiness(c, base));
    if (html.includes("<!--FAQ-->") && c.faq.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  }
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] || "Maruf Cafe";
  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || "";
  const head = [
    base && `<link rel="canonical" href="${esc(base + (path === "/" ? "/" : path))}">`,
    `<meta property="og:type" content="website"><meta property="og:site_name" content="Maruf Cafe"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">`,
    base && `<meta property="og:url" content="${esc(base + (path === "/" ? "/" : path))}"><meta property="og:image" content="${esc(base)}/og-image.png">`,
    `<meta name="twitter:card" content="${base ? "summary_large_image" : "summary"}">`,
    ...ld.map(jsonLd),
  ].filter(Boolean).join("\n");

  return html
    .replace("<!--HEAD-->", () => head)
    .replace(/<a\b[^>]*\bdata-needs="(\w+)"[^>]*>[\s\S]*?<\/a>/g, (m, key) => (b[key] ? m : ""))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m))
    .replace("<!--FAQ-->", () => faqHtml(c))
    .replace("<!--REVIEWS-->", () => reviewsHtml(c))
    .replace("<!--GALLERY-->", () => galleryHtml(c))
    .replace("<!--PACKAGES-->", () => packagesHtml(c))
    .replace("<!--VENUE-->", () => venueHtml(c))
    .replace(/<!--PHOTO:(\w+)-->/g, (m, slot) => photoHtml(c, slot));
}

export const robotsTxt = (base) => `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ""}`;
export const sitemapXml = (base, paths) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`).join("\n")}\n</urlset>\n`;
