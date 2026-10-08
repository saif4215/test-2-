// Small, forgiving parsers so customers can type dates and times the way they naturally would.

/** "12/20/2026", "12-20-26", "12/20" (this year, or next if already past) -> "2026-12-20", or "" if not a real date. */
export function parseDate(input, now = new Date()) {
  const m = String(input || "").trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/);
  if (!m) return "";
  const month = Number(m[1]), day = Number(m[2]);
  let year = m[3] ? Number(m[3]) : now.getFullYear();
  if (m[3] && m[3].length === 2) year += 2000;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return "";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!m[3] && d < today) { d.setFullYear(year + 1); }
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const isPast = (iso, now = new Date()) => new Date(`${iso}T23:59:59`) < now;

/** "5:30 PM", "5pm", "17:30", "5" (assumed PM before 7) -> "17:30", or "" if not a time. Blank input is allowed upstream. */
export function parseTime(input) {
  const m = String(input || "").trim().toLowerCase().replace(/\s+/g, "").match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return "";
  let h = Number(m[1]); const min = Number(m[2] || 0);
  if (min > 59) return "";
  if (m[3]) { if (h < 1 || h > 12) return ""; h = (h % 12) + (m[3] === "pm" ? 12 : 0); }
  else if (h > 23) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Is the café open at `now`, in New York time? Returns { open, closesAt|opensAt } using config hours. */
export function openStatus(hours, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const today = hours.find((h) => h.days.includes(day));
  const fmt = (h) => { const w = Math.floor(h) % 24, m = Math.round((h % 1) * 60); return `${w % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${w < 12 ? "AM" : "PM"}`; };
  if (today && minutes >= today.open * 60 && minutes < today.close * 60) return { open: true, text: `Open now · until ${fmt(today.close)}` };
  if (today && minutes < today.open * 60) return { open: false, text: `Closed · opens ${fmt(today.open)}` };
  const next = hours.find((h) => h.days.includes((day + 1) % 7));
  return { open: false, text: next ? `Closed · opens ${fmt(next.open)} tomorrow` : "Closed" };
}
