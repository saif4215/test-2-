import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { apiUrl, business, faq, packages, packagesNote } from "../config";
import bundledMenu from "../data/menu.json";
import { BLANK_VENUE, mergeSite, withImageUrls } from "./site-merge";

/** What the app ships with. Always usable offline and before the server answers. */
export const BUNDLED = { business, faq, packages, packagesNote, featuredTitle: "Try these", venue: BLANK_VENUE, gallery: [], reviews: [], photos: {}, menu: withImageUrls(bundledMenu, "") };

const Ctx = createContext(BUNDLED);

async function getJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${apiUrl}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

const REFRESH_AFTER_MS = 60 * 1000;   // coming back to the app within a minute does not hit the server again

/**
 * Provides the café's live menu and details. On the web build served by the café's own server the address is
 * the same site; in a phone build it needs EXPO_PUBLIC_API_URL. Without a server the bundled copy is used.
 * `refresh()` loads them again (pull down on a screen, or coming back to the app after a minute): the café's edits show up
 * without the customer having to close the app. A failed refresh keeps what is already on screen.
 */
export function SiteProvider({ children }) {
  const [site, setSite] = useState(BUNDLED);
  const last = useRef(0), busy = useRef(false);
  const canLoad = !!apiUrl || Platform.OS === "web";
  const refresh = useCallback(async () => {
    if (!canLoad || busy.current) return;
    busy.current = true;
    try {
      const [content, menu] = await Promise.all([getJson("/content.json"), getJson("/menu.json")]);
      if (content || menu) { setSite(mergeSite(BUNDLED, { ...(content || {}), ...(menu ? { menu } : {}) }, apiUrl)); last.current = Date.now(); }
    } finally { busy.current = false; }
  }, [canLoad]);
  useEffect(() => {
    if (!canLoad) return undefined;
    refresh();
    const sub = AppState.addEventListener("change", (state) => { if (state === "active" && Date.now() - last.current > REFRESH_AFTER_MS) refresh(); });
    return () => sub.remove();
  }, [canLoad, refresh]);
  const value = useMemo(() => ({ ...site, refresh }), [site, refresh]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useSite = () => useContext(Ctx);
