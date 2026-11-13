import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addUsual as addUsualTo, awardPoints as awardTo, readActive, readPoints, readHistory, readObject, readSaved, readUsuals, recordHistory, recordOrder, removeUsual as removeUsualFrom, toggleFavorite as toggle } from "./memory-util";

// What the app remembers on this phone (the browser's own storage on the web): favorite items, the last few orders sent, and the name and phone used for pickup.
// Nothing here leaves the phone, and if the phone will not store it the app simply forgets it when it closes.
const KEYS = { favorites: "maruf:favorites", recent: "maruf:recent-orders", contact: "maruf:contact", active: "maruf:active-order", usuals: "maruf:usuals", history: "maruf:history", points: "maruf:points" };
const NO_CONTACT = { name: "", phone: "" };
const Ctx = createContext({ favorites: [], recent: [], usuals: [], history: [], points: { balance: 0, awarded: [] }, awardPoints() {}, addUsual() {}, removeUsual() {}, contact: NO_CONTACT, active: null, activeStatus: "received", toggleFavorite() {}, rememberOrder() {}, rememberContact() {}, rememberActive() {}, forgetActive() {}, setActiveStatus() {} });

const isOrder = (o) => Array.isArray(o) && o.every((l) => l && typeof l.id === "string" && Number.isFinite(l.qty));
const readContact = (c) => (c && typeof c.name === "string" && typeof c.phone === "string" ? { name: c.name.slice(0, 60), phone: c.phone.slice(0, 20) } : NO_CONTACT);

export function MemoryProvider({ children }) {
  const [favorites, setFavorites] = useState([]), [recent, setRecent] = useState([]), [contact, setContact] = useState(NO_CONTACT), [active, setActive] = useState(null), [usuals, setUsuals] = useState([]), [points, setPoints] = useState({ balance: 0, awarded: [] }), [history, setHistory] = useState([]), [activeStatus, setActiveStatus] = useState("received"), [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [f, r, c, a, u, hi, pt] = await Promise.all([AsyncStorage.getItem(KEYS.favorites), AsyncStorage.getItem(KEYS.recent), AsyncStorage.getItem(KEYS.contact), AsyncStorage.getItem(KEYS.active), AsyncStorage.getItem(KEYS.usuals), AsyncStorage.getItem(KEYS.history), AsyncStorage.getItem(KEYS.points)]);
        if (live) { setUsuals(readUsuals(readSaved(u, []))); setHistory(readHistory(readSaved(hi, []))); setPoints((cur) => (cur.balance ? cur : readPoints(readObject(pt, null)))); setFavorites(readSaved(f, []).filter((x) => typeof x === "string")); setRecent(readSaved(r, []).filter(isOrder)); setContact(readContact(readObject(c, null))); setActive((cur) => cur || readActive(readObject(a, null))); }
      } catch { /* storage is not available: start empty */ }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.favorites, JSON.stringify(favorites)).catch(() => {}); }, [favorites, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.recent, JSON.stringify(recent)).catch(() => {}); }, [recent, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.usuals, JSON.stringify(usuals)).catch(() => {}); }, [usuals, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.points, JSON.stringify(points)).catch(() => {}); }, [points, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.history, JSON.stringify(history)).catch(() => {}); }, [history, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.contact, JSON.stringify(contact)).catch(() => {}); }, [contact, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.active, JSON.stringify(active)).catch(() => {}); }, [active, ready]);
  const toggleFavorite = useCallback((id) => setFavorites((cur) => toggle(cur, id)), []);
  const rememberOrder = useCallback((entries, meta) => { setRecent((cur) => recordOrder(cur, entries)); if (meta) setHistory((cur) => recordHistory(cur, entries, meta)); }, []);   // `meta` ({ at, subtotal }) is given when the order was really sent: only then does it join the history
  /** Count an order's points (once). Called when the café's Square says the order was picked up. */
  const awardPoints = useCallback((orderId, pts) => setPoints((cur) => awardTo(cur, orderId, pts)), []);
  const addUsual = useCallback((u) => setUsuals((cur) => addUsualTo(cur, u)), []);
  const removeUsual = useCallback((id) => setUsuals((cur) => removeUsualFrom(cur, id)), []);
  const rememberContact = useCallback((name, phone) => setContact(readContact({ name, phone })), []);
  /** The order just placed: Home shows where it stands until it is picked up or canceled and the customer closes the card. */
  const rememberActive = useCallback((o) => { const a = readActive({ ...o, at: Date.now() }); setActive(a); setActiveStatus("received"); }, []);
  const forgetActive = useCallback(() => setActive(null), []);
  const value = useMemo(() => ({ points, awardPoints, usuals, history, addUsual, removeUsual, favorites, recent, contact, active, activeStatus, toggleFavorite, rememberOrder, rememberContact, rememberActive, forgetActive, setActiveStatus }), [points, awardPoints, usuals, history, addUsual, removeUsual, favorites, recent, contact, active, activeStatus, toggleFavorite, rememberOrder, rememberContact, rememberActive, forgetActive]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useMemory = () => useContext(Ctx);
