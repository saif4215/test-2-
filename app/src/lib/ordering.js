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

let known = { at: 0, on: false, tax: 0, minMinutes: 30 };
/** Does the café's server take orders into Square, and what tax does it add? Asked once a minute at most. */
export async function loadOrderingConfig() {
  if (!canReachServer()) return { on: false, tax: 0, minMinutes: 30 };
  if (Date.now() - known.at < 60000) return known;
  try {
    const res = await request("/api/config", { headers: { Accept: "application/json" } }, 8000);
    const json = res.ok ? await res.json() : null;
    const tax = Number(json?.taxPercent);
    const prep = Number(json?.pickup?.minMinutes);   // the café's prep time: the earliest pickup time a customer can choose
    known = { at: Date.now(), on: json?.enabled === true, tax: Number.isFinite(tax) && tax > 0 && tax <= 20 ? tax : 0, minMinutes: Number.isFinite(prep) && prep >= 5 && prep <= 240 ? prep : 30 };
  } catch { known = { at: Date.now() - 50000, on: false, tax: 0, minMinutes: 30 }; }   // try again soon
  return known;
}
export const loadOrdering = async () => (await loadOrderingConfig()).on;

/** { on, tax, minMinutes }: `on` is null while we do not know yet, then true or false; `tax` is the percentage the café adds (0 when none is set); `minMinutes` is the earliest pickup time from now. */
export function useOrderingConfig() {
  const [cfg, setCfg] = useState({ on: null, tax: 0, minMinutes: 30 });
  useEffect(() => { let live = true; loadOrderingConfig().then((c) => { if (live) setCfg({ on: c.on, tax: c.tax, minMinutes: c.minMinutes }); }); return () => { live = false; }; }, []);
  return cfg;
}

/** null while we do not know yet, then true or false. */
export const useOrdering = () => useOrderingConfig().on;

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
