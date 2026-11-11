import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MAX_QTY, cartToSave, readCart, readObject } from "./memory-util";
import { indexMenu } from "./site-merge";
import { cleanNote, orderSummary } from "./order-util";
import { describeCustom, missingRequired, orderChoice, setSize as sizeChoice, togglePick, unitCents } from "./customize";
import { useSite } from "./site";

const money = (c) => `$${(c / 100).toFixed(2)}`;
/** The price as a menu shows it: one price, or the range across sizes ("$3.00 – $3.50"). */
export const priceText = (it) => {
  if (it.sizes && it.sizes.length > 1) { const all = it.sizes.map((s) => s.cents); return `${money(Math.min(...all))} – ${money(Math.max(...all))}`; }
  return it.cents != null ? money(it.cents) : `${money(it.min)} – ${money(it.max)}`;
};

const Ctx = createContext(null);

const CART_KEY = "maruf:cart";

/** The customer's running order list. It is kept on the phone, so closing the app does not lose it (and the order is emptied once it is placed). */
export function OrderProvider({ children }) {
  const { menu } = useSite();
  const itemsById = useMemo(() => indexMenu(menu), [menu]);
  const [lines, setLines] = useState({});   // id -> qty
  const [notes, setNotes] = useState({});   // id -> what the customer typed for that item (kept short)
  const [custom, setCustomState] = useState({});   // id -> the size and choices (milk, syrup, add-ons ...), see customize.js
  const [ready, setReady] = useState(false);
  // what was in the order when the app was last open comes back once the phone has read it (anything added meanwhile is kept)
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const saved = readCart(readObject(await AsyncStorage.getItem(CART_KEY), null));
        if (live) { setLines((cur) => ({ ...saved.lines, ...cur })); setNotes((cur) => ({ ...saved.notes, ...cur })); setCustomState((cur) => ({ ...saved.custom, ...cur })); }
      } catch { /* storage is not available: start empty */ }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(CART_KEY, JSON.stringify(cartToSave({ lines, notes, custom }))).catch(() => {}); }, [lines, notes, custom, ready]);
  const change = useCallback((id, d) => setLines((cur) => {
    const next = { ...cur }, q = Math.max(0, Math.min(MAX_QTY, (cur[id] || 0) + d));
    if (q) next[id] = q; else delete next[id];
    return next;
  }), []);
  /** Set how many of an item are in the order (0 takes it out). */
  const setQty = useCallback((id, qty) => setLines((cur) => {
    const next = { ...cur }, q = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(qty) || 0)));
    if (q) next[id] = q; else delete next[id];
    return next;
  }), []);
  const clear = useCallback(() => { setLines({}); setNotes({}); setCustomState({}); }, []);
  /** Pick a size for an item. */
  const chooseSize = useCallback((id, name) => setCustomState((cur) => ({ ...cur, [id]: sizeChoice(cur[id], name) })), []);
  /** Tap one of an item's choices (see togglePick). `item` is the menu item, so the choice can be checked against what it offers. */
  const choose = useCallback((item, setId, name) => setCustomState((cur) => ({ ...cur, [item.id]: togglePick(item, cur[item.id], setId, name) })), []);
  const resetCustom = useCallback((id) => setCustomState((cur) => { const next = { ...cur }; delete next[id]; return next; }), []);
  const setNote = useCallback((id, text) => setNotes((cur) => { const next = { ...cur }, t = cleanNote(text); if (t.trim()) next[id] = t; else delete next[id]; return next; }), []);
  /** Add several items at once, e.g. "order again": [{ id, qty, choice? }]. A given choice (size, milk ... remembered from last time, or put together by the assistant) replaces any chosen before. */
  const addMany = useCallback((list) => {
    setLines((cur) => {
      const next = { ...cur };
      for (const l of list) if (l && l.id && l.qty > 0) next[l.id] = Math.min(MAX_QTY, (next[l.id] || 0) + l.qty);
      return next;
    });
    setCustomState((cur) => {
      const next = { ...cur };
      for (const l of list) if (l && l.id && l.qty > 0 && l.choice && typeof l.choice === "object") next[l.id] = l.choice;
      return next;
    });
  }, []);
  const value = useMemo(() => {
    // An item the café has since removed from the menu simply drops out of the list. Each line knows its price with the size and choices.
    const entries = Object.entries(lines).filter(([id]) => itemsById.has(id)).map(([id, qty]) => {
      const item = itemsById.get(id);
      return { ...item, qty, unit: unitCents(item, custom[id]), choice: orderChoice(item, custom[id]), missing: missingRequired(item, custom[id]) };
    });
    const low = entries.reduce((s, l) => s + (l.unit ?? l.min) * l.qty, 0);
    const high = entries.reduce((s, l) => s + (l.unit ?? l.max) * l.qty, 0);
    const count = entries.reduce((s, l) => s + l.qty, 0);
    // What the customer asked for on each item: the size and choices, then anything they typed. Sent with the quote request.
    const details = {};
    for (const l of entries) { const text = [describeCustom(l, custom[l.id]), notes[l.id]].filter(Boolean).join("; "); if (text) details[l.id] = text; }
    const summary = orderSummary(entries, details);
    const incomplete = entries.filter((l) => l.missing.length);   // lines that still need a must-pick choice (hot or iced ...)
    return { lines, entries, incomplete, count, low, high, exact: low === high, summary, notes, custom, details, setNote, chooseSize, choose, resetCustom, addMany, change, setQty, clear };
  }, [lines, notes, custom, itemsById, change, setQty, clear, setNote, chooseSize, choose, resetCustom, addMany]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useOrder = () => useContext(Ctx);
export { money };
