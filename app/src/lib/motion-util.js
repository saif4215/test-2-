// The numbers behind the app's animations, kept free of any screen code so they can be tested in plain Node.

export const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
export const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3;

/** A number counting up (or down) from `from` to `to`: where it is after t of the way (0 to 1). Always a whole number, and exactly `to` at the end. */
export function countAt(from, to, t) {
  const a = Number.isFinite(from) ? from : 0, b = Number.isFinite(to) ? to : 0;
  if (clamp01(t) >= 1) return Math.round(b);
  return Math.round(a + (b - a) * easeOutCubic(t));
}

/** How full the cup is for each stage of an order: sent, being made, ready, picked up, canceled. */
const CUP_LEVELS = { received: 0.18, accepted: 0.6, ready: 1, done: 1, canceled: 0 };
export const cupLevel = (status) => (status in CUP_LEVELS ? CUP_LEVELS[status] : CUP_LEVELS.received);

/** What the cup shows besides its level: steam when it is ready, bubbles while it is being made, and greyed out when canceled. */
export const cupMood = (status) => ({ steam: status === "ready", bubbles: status === "accepted", dim: status === "canceled" });

const SIZE_SCALES = [0.84, 1, 1.14];
/** The cup is drawn smaller or bigger to follow the size chosen: [Small, Large] or [Small, Medium, Large] ... Items with one size (or none) are drawn at normal size. */
export function cupScale(sizes, size) {
  const list = Array.isArray(sizes) ? sizes : [];
  if (list.length < 2) return 1;
  const i = Math.max(0, list.findIndex((s) => s && s.name === size));
  const f = i / (list.length - 1);
  return Number((SIZE_SCALES[0] + (SIZE_SCALES[2] - SIZE_SCALES[0]) * f).toFixed(3));
}

const TINTS = [
  [/matcha|green tea/i, "#9BB36B"],
  [/mocha|chocolate|cocoa/i, "#5A3A28"],
  [/chai/i, "#B98A52"],
  [/tea/i, "#C58A3F"],
  [/oat/i, "#C9A57A"],
  [/almond/i, "#CDB08A"],
  [/soy/i, "#D4BC95"],
  [/coconut/i, "#E2D3B8"],
  [/lemon|lemonade/i, "#EBD66A"],
  [/strawberry|berry|hibiscus/i, "#C8566B"],
];
const COFFEE = "#7A4A2A";

/**
 * How the drink in the cup looks for what is chosen: { scale, iced, tint }. `item` is the menu item (name, category, sizes) and
 * `chosen` is what resolve() gives: { size, picks: { setId: [names] } }. Only ever a picture: it never changes the order or the price.
 */
export function drinkLook(item, chosen) {
  const picks = (chosen && chosen.picks) || {};
  const names = Object.values(picks).flat().filter((n) => typeof n === "string");
  const iced = names.some((n) => /iced|cold|over ice/i.test(n)) || /iced|cold brew|frapp|smoothie|lemonade/i.test(`${item?.name || ""}`);
  const tintName = names.find((n) => TINTS.some(([re]) => re.test(n)));
  const hay = tintName || `${item?.name || ""} ${item?.cat || ""}`;
  const hit = TINTS.find(([re]) => re.test(hay));
  return { scale: cupScale(item?.sizes, chosen?.size), iced, tint: hit ? hit[1] : COFFEE };
}

/** Where the points shown on screen should count from: the last number shown, or straight to the new one the first time. */
export const countStart = (shown, target) => (Number.isFinite(shown) ? shown : target);

/** Is this item a drink (so the customizer can show a cup)? Looks for a hot-or-iced choice, or a drink in its name or category. */
export function isDrink(item) {
  if (!item) return false;
  if ((item.optionSets || []).some((s) => s && (s.id === "temp" || /hot or iced/i.test(s.label || "")))) return true;
  return /coffee|latte|espresso|cappuccino|macchiato|americano|mocha|chai|matcha|\btea\b|smoothie|juice|lemonade|shake|frapp|cold brew|drink|beverage/i.test(`${item.cat || ""} ${item.name || ""}`);
}
