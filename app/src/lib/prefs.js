import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The choices a customer makes in Settings, kept on their own phone: how the app looks (follow the phone, always light, always dark) and how the Menu is laid out.
const KEYS = { appearance: "maruf:appearance", menuLayout: "maruf:menu-layout" };
import { DEFAULTS, cleanPref } from "./prefs-util";

let state = { ...DEFAULTS };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

// Load what was saved, once, then tell whoever is listening.
AsyncStorage.multiGet([KEYS.appearance, KEYS.menuLayout]).then((pairs) => {
  const got = Object.fromEntries(pairs || []);
  state = { appearance: cleanPref("appearance", got[KEYS.appearance]), menuLayout: cleanPref("menuLayout", got[KEYS.menuLayout]) };
  emit();
}).catch(() => {});

export function setPref(name, value) {
  const v = cleanPref(name, value);
  if (state[name] === v) return;
  state = { ...state, [name]: v };
  AsyncStorage.setItem(KEYS[name], v).catch(() => {});
  emit();
}

/** Back to the defaults (used by "Clear everything on this phone"). */
export function resetPrefs() { state = { ...DEFAULTS }; emit(); }

/** { appearance, menuLayout }, redrawing the screen when either changes. */
export const usePrefs = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
