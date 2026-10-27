import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readSaved, recordOrder, toggleFavorite as toggle } from "./memory-util";

// What the app remembers on this phone (the browser's own storage on the web): favorite items and the last few orders sent.
// Nothing here leaves the phone, and if the phone will not store it the app simply forgets it when it closes.
const KEYS = { favorites: "maruf:favorites", recent: "maruf:recent-orders" };
const Ctx = createContext({ favorites: [], recent: [], toggleFavorite() {}, rememberOrder() {} });

const isOrder = (o) => Array.isArray(o) && o.every((l) => l && typeof l.id === "string" && Number.isFinite(l.qty));

export function MemoryProvider({ children }) {
  const [favorites, setFavorites] = useState([]), [recent, setRecent] = useState([]), [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [f, r] = await Promise.all([AsyncStorage.getItem(KEYS.favorites), AsyncStorage.getItem(KEYS.recent)]);
        if (live) { setFavorites(readSaved(f, []).filter((x) => typeof x === "string")); setRecent(readSaved(r, []).filter(isOrder)); }
      } catch { /* storage is not available: start empty */ }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.favorites, JSON.stringify(favorites)).catch(() => {}); }, [favorites, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEYS.recent, JSON.stringify(recent)).catch(() => {}); }, [recent, ready]);
  const toggleFavorite = useCallback((id) => setFavorites((cur) => toggle(cur, id)), []);
  const rememberOrder = useCallback((entries) => setRecent((cur) => recordOrder(cur, entries)), []);
  const value = useMemo(() => ({ favorites, recent, toggleFavorite, rememberOrder }), [favorites, recent, toggleFavorite, rememberOrder]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useMemory = () => useContext(Ctx);
