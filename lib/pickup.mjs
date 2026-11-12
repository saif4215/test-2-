// Choosing a pickup time: which times a customer may pick, and whether a time they sent is one of them. The café is in New York, so all times are New York time.
// A time is allowed when it is today, falls inside the café's opening hours, and is at least `minMinutes` from now (the café's prep time).
// hours: [{ days: [0..6], open: 7, close: 22 }] with open and close as hours on a 24-hour clock (the same hours the rest of the app uses).

const NY = "America/New_York";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The New York date, weekday and minutes since midnight at this moment. */
export function nyParts(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: NY, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), weekday: DAYS.indexOf(p.weekday), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The moment that is `minutes` after midnight on that New York date. */
export function nyDate(year, month, day, minutes) {
  let guess = Date.UTC(year, month - 1, day, 0, minutes);
  for (let i = 0; i < 2; i++) {   // the second pass settles the clock change days
    const q = nyParts(new Date(guess));
    guess += Date.UTC(year, month - 1, day, 0, minutes) - Date.UTC(q.year, q.month - 1, q.day, 0, q.minutes);
  }
  return new Date(guess);
}

const clock = (m) => { const h = Math.floor(m / 60) % 24, min = m % 60; return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** The pickup times still open today, every `step` minutes: [{ at: ISO time, label: "5:15 PM" }]. Empty when the café is closed for the day or has no time left. */
export function pickupSlots(hours, now = new Date(), { minMinutes = 30, step = 15 } = {}) {
  const t = nyParts(now), today = (hours || []).find((h) => h.days.includes(t.weekday));
  if (!today) return [];
  const first = Math.max(Math.ceil((t.minutes + minMinutes) / step) * step, Math.ceil((today.open * 60) / step) * step);
  const out = [];
  for (let m = first; m < today.close * 60 && out.length < 40; m += step) out.push({ at: nyDate(t.year, t.month, t.day, m).toISOString(), label: clock(m) });
  return out;
}

/** Is this time one the café can take? Returns "" when it is, otherwise a plain sentence for the customer. */
export function pickupProblem(iso, hours, now = new Date(), { minMinutes = 30 } = {}) {
  const at = new Date(iso);
  if (typeof iso !== "string" || Number.isNaN(at.getTime())) return "That pickup time isn't valid. Choose another.";
  const t = nyParts(now), p = nyParts(at), today = (hours || []).find((h) => h.days.includes(t.weekday));
  if (p.year !== t.year || p.month !== t.month || p.day !== t.day) return "Pickup times are for today only. Choose a time today, or as soon as possible.";
  if (!today || p.minutes < today.open * 60 || p.minutes >= today.close * 60) return "Maruf Cafe isn't open at that time. Choose a time while the café is open.";
  if (at.getTime() < now.getTime() + (minMinutes - 2) * 60000) return "That pickup time is too soon. Choose a later time, or as soon as possible.";
  return "";
}

/** "5:15 PM" for a pickup time, in New York time. */
export const pickupLabel = (iso) => { const p = nyParts(new Date(iso)); return clock(p.minutes); };
