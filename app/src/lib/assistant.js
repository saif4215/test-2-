import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { apiUrl } from "../config";
import { trimHistory } from "./assistant-util";

/** Without a server address a phone build cannot reach the assistant. The web build uses its own server. */
export const canReachServer = () => !!apiUrl || Platform.OS === "web";

/** How the chat answers: "ai" (an AI service is connected), "basic" (answers from the café's own details, no key needed), or null (cannot reach the server). */
export async function assistantMode() {
  if (!canReachServer()) return null;
  try {
    const res = await fetch(`${apiUrl}/api/assistant`, { headers: { Accept: "application/json" } });
    const json = res.ok ? await res.json() : {};
    return json.enabled === true ? (json.mode === "ai" ? "ai" : "basic") : null;
  } catch { return null; }
}

let modeAt = 0, modeKnown;
/** The same as assistantMode, remembered for a minute so every screen can ask. undefined while checking. */
export function useAssistantMode() {
  const [mode, setMode] = useState(Date.now() - modeAt < 60000 ? modeKnown : undefined);
  useEffect(() => {
    let live = true;
    if (Date.now() - modeAt < 60000) { setMode(modeKnown); return undefined; }
    assistantMode().then((m) => { modeKnown = m; modeAt = Date.now(); if (live) setMode(m); });
    return () => { live = false; };
  }, []);
  return mode;
}

/** Resolves { ok: true, reply, add, handoff } (add: items to review, only when an AI is connected; handoff: a person should answer, so the chat shows a Call button) or { ok: false, error }. Never invents an answer. */
export async function askAssistant(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${apiUrl}/api/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ messages: trimHistory(messages) }) });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.reply) return { ok: true, reply: json.reply, add: Array.isArray(json.add) ? json.add : [], handoff: json.handoff === true };
    return { ok: false, error: json.error || "The assistant could not answer. Please try again, or call us." };
  } catch {
    return { ok: false, error: "We could not reach Maruf Cafe. Check your connection and try again, or call us." };
  } finally { clearTimeout(timer); }
}
