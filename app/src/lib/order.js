import { createContext, createElement, useCallback, useContext, useMemo, useState } from "react";
import menu from "../data/menu.json";

/** id -> item, for every item on the menu. */
export const itemsById = (() => {
  const map = new Map();
  for (const [group, cats] of Object.entries(menu.groups)) for (const [cat, items] of Object.entries(cats)) for (const it of items) map.set(it.id, { ...it, group, cat });
  return map;
})();

const money = (c) => `$${(c / 100).toFixed(2)}`;
export const priceText = (it) => (it.cents != null ? money(it.cents) : `${money(it.min)} – ${money(it.max)}`);

const Ctx = createContext(null);

/** The customer's running order list (kept in memory while the app is open). */
export function OrderProvider({ children }) {
  const [lines, setLines] = useState({});   // id -> qty
  const change = useCallback((id, d) => setLines((cur) => {
    const next = { ...cur }, q = Math.max(0, Math.min(50, (cur[id] || 0) + d));
    if (q) next[id] = q; else delete next[id];
    return next;
  }), []);
  const clear = useCallback(() => setLines({}), []);
  const value = useMemo(() => {
    const entries = Object.entries(lines).map(([id, qty]) => ({ ...itemsById.get(id), qty }));
    const low = entries.reduce((s, l) => s + (l.cents ?? l.min) * l.qty, 0);
    const high = entries.reduce((s, l) => s + (l.cents ?? l.max) * l.qty, 0);
    const count = entries.reduce((s, l) => s + l.qty, 0);
    const summary = entries.map((l) => `${l.qty} x ${l.name}`).join("\n");
    return { lines, entries, count, low, high, exact: low === high, summary, change, clear };
  }, [lines, change, clear]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useOrder = () => useContext(Ctx);
export { money };
