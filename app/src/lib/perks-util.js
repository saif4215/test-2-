// Small perks that need no server: the weekly streak. Plain functions, tested in Node.

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
