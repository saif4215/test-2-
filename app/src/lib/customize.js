// "Make it your way" for drinks: which controls a drink shows, and the short text the choices turn into. Plain functions, tested without a phone.
// These are requests that travel with the quote request as a note; Maruf Cafe confirms what it can make.
import { customize as defaults, drinkControls as defaultControls } from "../config";

export const EMPTY = Object.freeze({ size: "", temp: "", shots: 0, flavor: "", pumps: 0, milk: "", ice: "", sweetness: "", extras: [] });

/** The controls to show for an item, in order: [{ id, label, ... }]. Food has none. */
export function controlsFor(item, cfg = defaults, rules = defaultControls) {
  if (!item || item.group !== "Drinks") return [];
  const cat = String(item.cat || "").toLowerCase();
  const rule = rules.find((r) => new RegExp(r.match, "i").test(cat));
  const ids = rule ? rule.controls : ["size"];
  const ranged = item.cents == null;   // a price range means the price depends on size
  const out = [];
  for (const id of ids) {
    if (id === "size" && ranged && cfg.sizes?.length) out.push({ id, label: "Size", options: cfg.sizes });
    else if (id === "temp" && cfg.temps?.length) out.push({ id, label: "Temperature", options: cfg.temps });
    else if (id === "shots" && cfg.maxShots > 0) out.push({ id, label: "Espresso shots", max: cfg.maxShots, unit: "shot" });
    else if (id === "syrup" && cfg.flavors?.length && cfg.maxPumps > 0) out.push({ id, label: "Syrup", options: cfg.flavors, max: cfg.maxPumps, unit: "pump" });
    else if (id === "milk" && cfg.milks?.length) out.push({ id, label: "Milk", options: cfg.milks });
    else if (id === "ice" && cfg.ice?.length) out.push({ id, label: "Ice", options: cfg.ice, onlyIced: !/refresher/.test(cat) });
    else if (id === "sweetness" && cfg.sweetness?.length) out.push({ id, label: "Sweetness", options: cfg.sweetness });
    else if (id === "extras" && cfg.extras?.length) out.push({ id, label: "Extras", options: cfg.extras, multi: true });
  }
  return out;
}

/** Is this control showing right now? Ice only follows a drink asked for Iced (refreshers always show it). */
export const isShown = (control, custom) => !control.onlyIced || custom.temp === "Iced";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A choice changes, and anything that no longer applies is cleared (going from Iced back to Hot drops the ice request). */
export function applyChoice(custom, patch) {
  const next = { ...EMPTY, ...custom, ...patch };
  if (patch.temp !== undefined && next.temp !== "Iced") next.ice = "";
  if (patch.flavor && !next.pumps) next.pumps = 1;                  // picking a flavor asks for at least one pump
  if (patch.pumps === 0) next.flavor = "";
  return next;
}

/** Keep only what is allowed: unknown choices and out-of-range counts are dropped. Returns a fresh object. */
export function cleanCustom(custom, controls) {
  const c = { ...EMPTY, ...custom }, out = { ...EMPTY, extras: [] };
  for (const ctl of controls) {
    if (!isShown(ctl, c)) continue;
    if (ctl.id === "shots") out.shots = Math.max(0, Math.min(ctl.max, Math.floor(Number(c.shots) || 0)));
    else if (ctl.id === "syrup") { out.pumps = Math.max(0, Math.min(ctl.max, Math.floor(Number(c.pumps) || 0))); out.flavor = out.pumps && ctl.options.includes(c.flavor) ? c.flavor : ""; }
    else if (ctl.id === "extras") out.extras = ctl.options.filter((o) => (c.extras || []).includes(o));
    else if (ctl.options.includes(c[ctl.id])) out[ctl.id] = c[ctl.id];
  }
  return out;
}

/** "Iced, 2 shots, 2 pumps Vanilla, Oat milk, Light ice, Whipped cream": what the customer asked for, in a fixed order. Empty when nothing was chosen. */
export function describeCustom(custom, controls) {
  const c = cleanCustom(custom || {}, controls), parts = [];
  if (c.size) parts.push(c.size);
  if (c.temp) parts.push(c.temp);
  if (c.shots) parts.push(plural(c.shots, "shot"));
  if (c.pumps) parts.push(`${plural(c.pumps, "pump")}${c.flavor ? ` ${c.flavor}` : " of syrup"}`);
  if (c.milk) parts.push(c.milk);
  if (c.ice) parts.push(c.ice);
  if (c.sweetness) parts.push(c.sweetness);
  parts.push(...c.extras);
  return parts.join(", ");
}
