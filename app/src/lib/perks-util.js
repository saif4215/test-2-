// Small perks that need no server: the weekly streak and the birthday treat. Plain functions, tested in Node.

const DAY = 86400000;
/** Midnight at the start of the Monday of the week that `ms` is in, in the phone's own time zone. */
export function weekStart(ms) {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7;   // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
}
/** Weeks are counted as whole steps (the Monday's calendar date taken as UTC), so a daylight-saving change or a time zone can never split or merge one. */
const weekIndex = (ms) => {
  const d = new Date(ms), day = (d.getDay() + 6) % 7;
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - day) / (7 * DAY));
};

/** The streak milestones people can aim for. */
export const STREAK_GOALS = [2, 4, 8, 12, 26, 52];

/**
 * The weekly streak from the orders placed in the app (history is newest first, each with `at`): how many weeks in a row (Monday to Sunday)
 * have an order, counting back from this week. If nothing was ordered yet this week but last week had an order, the streak is still alive: order before Sunday ends to keep it.
 * Returns { weeks, alive, thisWeek, days, daysLeft, next }:
 *   days: seven true/false, Monday first, for this week's orders;  daysLeft: days left this week including today;  next: the next milestone, or 0.
 */
export function weekStreak(history, now = Date.now()) {
  const stamps = (Array.isArray(history) ? history : []).map((h) => Number(h && h.at)).filter((t) => Number.isFinite(t) && t > 0 && t <= now + DAY);
  const days = [false, false, false, false, false, false, false];
  const start = weekStart(now), nowWeek = weekIndex(now);
  for (const t of stamps) if (weekStart(t) === start) days[(new Date(t).getDay() + 6) % 7] = true;
  const weeks = new Set(stamps.map(weekIndex));
  const thisWeek = weeks.has(nowWeek);
  let n = 0, w = thisWeek ? nowWeek : nowWeek - 1;
  while (weeks.has(w)) { n += 1; w -= 1; }
  const daysLeft = 7 - ((new Date(now).getDay() + 6) % 7);
  return { weeks: n, alive: n > 0, thisWeek, days, daysLeft, next: STREAK_GOALS.find((g) => g > n) || 0 };
}

/** What to say under the streak: plain and honest (no reward is promised, it is only a streak). */
export function streakLine(s) {
  if (!s.alive) return "";
  if (s.weeks === 1 && s.thisWeek) return "Your first week. Order again next week to start a streak.";
  if (!s.thisWeek) return s.daysLeft === 1 ? "Order today to keep your streak going." : `Order in the next ${s.daysLeft} days to keep your streak going.`;
  const more = s.next ? s.next - s.weeks : 0;
  return more ? `${more} more ${more === 1 ? "week" : "weeks"} to reach ${s.next}.` : "What a run. Thank you for coming so often!";
}

/** A birthday typed as "3/14", "03-14" or "March 14" -> "03-14" (month and day only; no year is kept). "" when it is not a real day. */
export function parseBirthday(input) {
  const t = String(input || "").trim();
  let m = /^(\d{1,2})\s*[/\-.]\s*(\d{1,2})$/.exec(t), month, day;
  if (m) { month = Number(m[1]); day = Number(m[2]); } else {
    m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})$/.exec(t);
    if (!m) return "";
    const names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    month = names.indexOf(m[1].slice(0, 3).toLowerCase()) + 1; day = Number(m[2]);
    if (!month) return "";
  }
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1])) return "";
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "03-14" -> "March 14". */
export function birthdayText(b) {
  const m = /^(\d\d)-(\d\d)$/.exec(b || "");
  if (!m) return "";
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(m[1]) - 1]} ${Number(m[2])}`;
}

/** The days a birthday treat can be claimed: the birthday itself and the six days after, so a busy week does not lose it. */
export const BIRTHDAY_DAYS = 7;

/** Is the treat open right now? true from the birthday for BIRTHDAY_DAYS days (a Feb 29 birthday counts on Feb 28 in other years). */
export function birthdayOpen(b, now = new Date()) {
  const m = /^(\d\d)-(\d\d)$/.exec(b || "");
  if (!m) return false;
  const month = Number(m[1]) - 1;
  let day = Number(m[2]);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const year of [now.getFullYear(), now.getFullYear() - 1]) {   // last year's, for a birthday just before New Year
    if (month === 1 && day === 29 && new Date(year, 1, 29).getMonth() !== 1) day = 28;
    const start = new Date(year, month, day);
    const diff = Math.round((today - start) / DAY);
    if (diff >= 0 && diff < BIRTHDAY_DAYS) return true;
  }
  return false;
}

/** The line added to an order's note when the customer takes their treat: "Birthday treat: a free cookie." The café's own words, cut to fit. */
export function birthdayNote(treat, note = "", max = 200) {
  const t = String(treat || "").trim().replace(/[.\s]+$/, "");
  if (!t) return String(note || "").slice(0, max);
  const line = `Birthday treat: ${t}.`.slice(0, max);
  const rest = String(note || "").trim();
  return rest ? `${line} ${rest}`.slice(0, max) : line;
}
