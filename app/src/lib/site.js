import { createContext, createElement, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { apiUrl, business, faq, packages, packagesNote } from "../config";
import bundledMenu from "../data/menu.json";
import { BLANK_VENUE, mergeSite } from "./site-merge";

/** What the app ships with. Always usable offline and before the server answers. */
export const BUNDLED = { business, faq, packages, packagesNote, featuredTitle: "Try these", venue: BLANK_VENUE, gallery: [], reviews: [], photos: {}, menu: bundledMenu };

const Ctx = createContext(BUNDLED);

async function getJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${apiUrl}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/**
 * Provides the café's live menu and details. On the web build served by the café's own server the address is
 * the same site; in a phone build it needs EXPO_PUBLIC_API_URL. Without a server the bundled copy is used.
 */
export function SiteProvider({ children }) {
  const [site, setSite] = useState(BUNDLED);
  useEffect(() => {
    if (!apiUrl && Platform.OS !== "web") return undefined;
    let live = true;
    Promise.all([getJson("/content.json"), getJson("/menu.json")]).then(([content, menu]) => {
      if (live && (content || menu)) setSite(mergeSite(BUNDLED, { ...(content || {}), ...(menu ? { menu } : {}) }, apiUrl));
    });
    return () => { live = false; };
  }, []);
  return createElement(Ctx.Provider, { value: site }, children);
}

export const useSite = () => useContext(Ctx);
