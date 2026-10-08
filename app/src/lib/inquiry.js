import { apiUrl } from "../config";

/**
 * Send a quote or event request to the Maruf Cafe server.
 * Resolves { ok: true } only when the server says it stored or sent the request.
 * Otherwise { ok: false, error, fields? } so the screen can say what to fix and never claim success.
 */
export async function submitInquiry(type, fields) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${apiUrl}/api/inquiry`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ type, fields, website: "" }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) return { ok: true };
    return { ok: false, error: json.error || "We could not send your request.", fields: json.fields || [] };
  } catch {
    return { ok: false, network: true, error: "We could not reach Maruf Cafe. Check your connection and try again, or call us." };
  } finally {
    clearTimeout(timer);
  }
}
