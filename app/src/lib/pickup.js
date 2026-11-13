// Pickup times a customer can choose. The same rules as the café's server (lib/pickup.mjs there, and a test keeps the two in step): today only,
// inside the opening hours, at least the café's prep time from now, every 15 minutes. All times are New York time, the café's.

const NY = "America/New_York";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function nyParts(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: NY, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), weekday: DAYS.indexOf(p.weekday), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function nyDate(year, month, day, minutes) {
  let guess = Date.UTC(year, month - 1, day, 0, minutes);
  for (let i = 0; i < 2; i++) {
    const q = nyParts(new Date(guess));
    guess += Date.UTC(year, month - 1, day, 0, minutes) - Date.UTC(q.year, q.month - 1, q.day, 0, q.minutes);
  }
  return new Date(guess);
}

const clock = (m) => { const h = Math.floor(m / 60) % 24, min = m % 60; return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** The pickup times still open today: [{ at: ISO time, label: "5:15 PM" }]. Empty when the café is closed for the day or has no time left. */
export function pickupSlots(hours, now = new Date(), { minMinutes = 30, step = 15 } = {}) {
  const t = nyParts(now), today = (hours || []).find((h) => h.days.includes(t.weekday));
  if (!today) return [];
  const first = Math.max(Math.ceil((t.minutes + minMinutes) / step) * step, Math.ceil((today.open * 60) / step) * step);
  const out = [];
  for (let m = first; m < today.close * 60 && out.length < 40; m += step) out.push({ at: nyDate(t.year, t.month, t.day, m).toISOString(), label: clock(m) });
  return out;
}

/** "5:15 PM" for a pickup time. */
export const pickupLabel = (iso) => clock(nyParts(new Date(iso)).minutes);
