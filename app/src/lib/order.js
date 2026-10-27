import { createContext, createElement, useCallback, useContext, useMemo, useState } from "react";
import { indexMenu } from "./site-merge";
import { cleanNote, orderSummary } from "./order-util";
import { applyChoice, controlsFor, describeCustom } from "./customize";
import { useSite } from "./site";

const money = (c) => `$${(c / 100).toFixed(2)}`;
export const priceText = (it) => (it.cents != null ? money(it.cents) : `${money(it.min)} – ${money(it.max)}`);

const Ctx = createContext(null);

/** The customer's running order list (kept in memory while the app is open). */
export function OrderProvider({ children }) {
  const { menu } = useSite();
  const itemsById = useMemo(() => indexMenu(menu), [menu]);
  const [lines, setLines] = useState({});   // id -> qty
  const [notes, setNotes] = useState({});   // id -> what the customer typed for that item (kept short)
  const [custom, setCustomState] = useState({});   // id -> the drink choices (size, shots, pumps, milk ...), see customize.js
  const change = useCallback((id, d) => setLines((cur) => {
    const next = { ...cur }, q = Math.max(0, Math.min(50, (cur[id] || 0) + d));
    if (q) next[id] = q; else delete next[id];
    return next;
  }), []);
  const clear = useCallback(() => { setLines({}); setNotes({}); setCustomState({}); }, []);
  const setCustom = useCallback((id, patch) => setCustomState((cur) => ({ ...cur, [id]: applyChoice(cur[id], patch) })), []);
  const resetCustom = useCallback((id) => setCustomState((cur) => { const next = { ...cur }; delete next[id]; return next; }), []);
  const setNote = useCallback((id, text) => setNotes((cur) => { const next = { ...cur }, t = cleanNote(text); if (t.trim()) next[id] = t; else delete next[id]; return next; }), []);
  /** Add several items at once, e.g. "order again": [{ id, qty }]. */
  const addMany = useCallback((list) => setLines((cur) => {
    const next = { ...cur };
    for (const l of list) if (l && l.id && l.qty > 0) next[l.id] = Math.min(50, (next[l.id] || 0) + l.qty);
    return next;
  }), []);
  const value = useMemo(() => {
    // An item the café has since removed from the menu simply drops out of the list.
    const entries = Object.entries(lines).filter(([id]) => itemsById.has(id)).map(([id, qty]) => ({ ...itemsById.get(id), qty }));
    const low = entries.reduce((s, l) => s + (l.cents ?? l.min) * l.qty, 0);
    const high = entries.reduce((s, l) => s + (l.cents ?? l.max) * l.qty, 0);
    const count = entries.reduce((s, l) => s + l.qty, 0);
    // What the customer asked for on each item: the drink choices, then anything they typed. Sent with the quote request.
    const details = {};
    for (const l of entries) { const text = [describeCustom(custom[l.id], controlsFor(l)), notes[l.id]].filter(Boolean).join("; "); if (text) details[l.id] = text; }
    const summary = orderSummary(entries, details);
    return { lines, entries, count, low, high, exact: low === high, summary, notes, custom, details, setNote, setCustom, resetCustom, addMany, change, clear };
  }, [lines, notes, custom, itemsById, change, clear, setNote, setCustom, resetCustom, addMany]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useOrder = () => useContext(Ctx);
export { money };
