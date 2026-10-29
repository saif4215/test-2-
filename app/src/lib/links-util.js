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

/**
 * Can this browser hand a call to a dialer? Yes for phones and tablets, which it checks three ways because one signal alone can miss
 * (and a missed iPhone would get a "copy the number" sheet instead of a call): the device's name (iPhone, Android...), an iPad asking for
 * the desktop site (it says Mac, but has a touch screen), or a touch screen as the main pointer. A laptop or desktop answers no.
 */
export function canPlaceCalls({ userAgent = "", platform = "", maxTouchPoints = 0, coarsePointer = false } = {}) {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent) || (/^Mac/i.test(platform) && maxTouchPoints > 1) || !!coarsePointer;
}
