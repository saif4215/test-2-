import { createContext, createElement, useCallback, useContext, useMemo, useState } from "react";
import { indexMenu } from "./site-merge";
import { useSite } from "./site";

const money = (c) => `$${(c / 100).toFixed(2)}`;
export const priceText = (it) => (it.cents != null ? money(it.cents) : `${money(it.min)} – ${money(it.max)}`);

const Ctx = createContext(null);

/** The customer's running order list (kept in memory while the app is open). */
export function OrderProvider({ children }) {
  const { menu } = useSite();
  const itemsById = useMemo(() => indexMenu(menu), [menu]);
  const [lines, setLines] = useState({});   // id -> qty
  const change = useCallback((id, d) => setLines((cur) => {
    const next = { ...cur }, q = Math.max(0, Math.min(50, (cur[id] || 0) + d));
    if (q) next[id] = q; else delete next[id];
    return next;
  }), []);
  const clear = useCallback(() => setLines({}), []);
  const value = useMemo(() => {
    // An item the café has since removed from the menu simply drops out of the list.
    const entries = Object.entries(lines).filter(([id]) => itemsById.has(id)).map(([id, qty]) => ({ ...itemsById.get(id), qty }));
    const low = entries.reduce((s, l) => s + (l.cents ?? l.min) * l.qty, 0);
    const high = entries.reduce((s, l) => s + (l.cents ?? l.max) * l.qty, 0);
    const count = entries.reduce((s, l) => s + l.qty, 0);
    const summary = entries.map((l) => `${l.qty} x ${l.name}`).join("\n");
    return { lines, entries, count, low, high, exact: low === high, summary, change, clear };
  }, [lines, itemsById, change, clear]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useOrder = () => useContext(Ctx);
export { money };
