import { calculator } from "../config";

/** How many of one option to plan for n guests, or null when the café has not provided the numbers. */
export function quantityFor(cfg, n) {
  if (cfg.perGuest) return Math.ceil(n * cfg.perGuest);
  if (cfg.serves) return Math.ceil(n / cfg.serves);
  return null;
}

/** Everything the calculator shows, as plain data (also used by the tests). */
export function plan(guests, selected, cfgs = calculator) {
  const n = Number.parseInt(guests, 10);
  if (!(n >= 1 && n <= 5000)) return { valid: false, lines: [] };
  const lines = Object.keys(cfgs).filter((k) => selected[k]).map((k) => {
    const cfg = cfgs[k], qty = quantityFor(cfg, n);
    return { key: k, label: cfg.label, qty, total: qty != null && cfg.price != null ? qty * cfg.price : null };
  });
  const priced = lines.length > 0 && lines.every((l) => l.total != null);
  return { valid: true, n, lines, total: priced ? lines.reduce((s, l) => s + l.total, 0) : null };
}

