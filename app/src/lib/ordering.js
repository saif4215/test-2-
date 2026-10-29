import { useEffect, useState } from "react";
import { apiUrl } from "../config";
import { canReachServer } from "./assistant";

// Placing an order: the app sends it to the café's server, which puts it into the café's Square. Nothing is paid in the app.
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const OFFLINE = "We could not reach Maruf Cafe. Check your connection and try again, or call us.";

async function request(path, init, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(`${apiUrl}${path}`, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

let known = { at: 0, on: false };
/** Does the café's server take orders into Square? Asked once a minute at most. */
export async function loadOrdering() {
  if (!canReachServer()) return false;
  if (Date.now() - known.at < 60000) return known.on;
  try {
    const res = await request("/api/config", { headers: { Accept: "application/json" } }, 8000);
    const json = res.ok ? await res.json() : null;
    known = { at: Date.now(), on: json?.enabled === true };
  } catch { known = { at: Date.now() - 50000, on: false }; }   // try again soon
  return known.on;
}

/** null while we do not know yet, then true or false. */
export function useOrdering() {
  const [on, setOn] = useState(null);
  useEffect(() => { let live = true; loadOrdering().then((v) => { if (live) setOn(v); }); return () => { live = false; }; }, []);
  return on;
}

/** Send the order. Resolves { ok: true, orderId, ref, totalCents, preview } only when the café's server says it is in Square. */
export async function sendOrder(body) {
  try {
    const res = await request("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, 20000);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.orderId) return { ok: true, orderId: json.orderId, ref: json.ref || "", totalCents: json.totalCents ?? null, preview: !!json.preview };
    return fail(json.error || "We could not send your order. Please try again, or call us.");
  } catch { return fail(OFFLINE, { network: true }); }
}

/** Where the order stands in the café: received, accepted, ready, done or canceled. */
export async function checkOrder(id) {
  try {
    const res = await request(`/api/order/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } }, 10000);
    const json = await res.json().catch(() => ({}));
    return res.ok && json.ok ? { ok: true, status: json.status } : fail(json.error || "");
  } catch { return fail(OFFLINE, { network: true }); }
}
