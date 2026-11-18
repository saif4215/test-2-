import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { notificationFor } from "./order-util";

// "Tell me when it's ready": a notification on the customer's own phone or computer when the café marks the order ready.
// On the web this works while the app is open, or open in the background (a home-screen app that is still running). It cannot reach a phone where
// the app was closed completely: that needs a push service, which is not set up. Nothing is shown unless the customer turned it on and allowed it.

const KEY = "maruf:notify";
const told = new Set();   // "orderId:ready" pairs already announced, so two screens watching the same order say it once

/** Does this device let a web page show notifications at all? */
export const notifySupported = () => Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window;

/** "unsupported", "default" (not asked yet), "granted" or "denied". */
export const notifyPermission = () => (notifySupported() ? window.Notification.permission : "unsupported");

async function register() {
  try { if ("serviceWorker" in navigator) return await navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }); } catch { /* some places do not allow it */ }
  return null;
}

/** Ask the customer's permission and remember they want these. Resolves the permission: "granted", "denied" or "unsupported". */
export async function enableNotify() {
  if (!notifySupported()) return "unsupported";
  let state = window.Notification.permission;
  if (state === "default") { try { state = await window.Notification.requestPermission(); } catch { state = window.Notification.permission; } }
  if (state === "granted") { await register(); try { await AsyncStorage.setItem(KEY, "1"); } catch { /* not remembered */ } }
  return state;
}

/** True when they turned it on and the browser still allows it. */
export async function notifyOn() {
  if (notifyPermission() !== "granted") return false;
  try { return (await AsyncStorage.getItem(KEY)) === "1"; } catch { return false; }
}

/** Show a notification for an order that just changed status (once per order and status). Never throws. */
export async function announceOrder(id, ref, prev, next) {
  try {
    const n = notificationFor(prev, next, ref);
    if (!n || !(await notifyOn())) return false;
    const key = `${id}:${n.kind}`;
    if (told.has(key)) return false;
    told.add(key);
    const options = { body: n.body, tag: `order-${id}`, icon: "/app/icon-192.png", badge: "/app/icon-192.png" };
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/app/").catch(() => null) : null;
    if (reg && reg.showNotification) await reg.showNotification(n.title, options);
    else new window.Notification(n.title, options);   // phones need the service worker above; computers can do this
    return true;
  } catch { return false; }
}
