// Plain helpers for links, kept free of React Native so they are tested without a phone.

/** What a tel: or mailto: link points at, for showing on screen: { kind: "phone" | "email", value }. */
export function parseContactLink(url) {
  const m = String(url).match(/^(tel|mailto):(.*)$/i);
  if (!m) return null;
  const value = decodeURIComponent(m[2].split("?")[0]).trim();
  return value ? { kind: m[1].toLowerCase() === "tel" ? "phone" : "email", value } : null;
}

/** A phone number as people read it: +19293353296 -> (929) 335-3296. Anything else is left as it is. */
export function prettyPhone(v) {
  const d = String(v).replace(/\D/g, "");
  const n = d.length === 11 && d[0] === "1" ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : String(v);
}
