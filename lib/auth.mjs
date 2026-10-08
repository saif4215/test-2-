// Admin sign-in: usernames and passwords come from environment variables, sessions live in memory,
// the cookie is HttpOnly and SameSite=Strict, and every change must carry a CSRF token.
import crypto from "node:crypto";

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const SESSION_MS = 12 * 60 * 60 * 1000;
export const MIN_PASSWORD = 10;

export function createAuth(env = process.env, { now = () => Date.now() } = {}) {
  const users = [], warnings = [];
  const add = (name, password, role) => {
    if (!password) return;
    if (password.length < MIN_PASSWORD) { warnings.push(`The ${role} password is shorter than ${MIN_PASSWORD} characters, so the ${role} account is switched off.`); return; }
    users.push({ name: String(name), role, hash: sha(password) });
  };
  add(env.ADMIN_USER || "owner", env.ADMIN_PASSWORD, "owner");
  add(env.STAFF_USER || "staff", env.STAFF_PASSWORD, "staff");

  const sessions = new Map();      // token -> { user, role, csrf, exp }
  const fails = new Map();         // "ip|user" or "ip" -> [timestamps]
  const dummy = sha("dummy");

  const recent = (key) => { const t = now(); const list = (fails.get(key) || []).filter((x) => t - x < 15 * 60 * 1000); fails.set(key, list); return list; };
  const sweep = () => { const t = now(); for (const [k, s] of sessions) if (s.exp < t) sessions.delete(k); if (fails.size > 5000) fails.clear(); };

  return {
    enabled: users.length > 0, warnings,
    /** Returns { ok: true, token, user, role, csrf } or { ok: false, status, error }. */
    login(name, password, ip) {
      sweep();
      const userKey = `${ip}|${String(name).toLowerCase()}`;
      if (recent(userKey).length >= 5 || recent(ip).length >= 30) return { ok: false, status: 429, error: "Too many sign-in attempts. Wait 15 minutes and try again." };
      const user = users.find((u) => u.name.toLowerCase() === String(name).toLowerCase());
      const given = sha(password ?? "");
      const match = crypto.timingSafeEqual(given, user ? user.hash : dummy) && !!user;
      if (!match) { recent(userKey).push(now()); recent(ip).push(now()); return { ok: false, status: 401, error: "Wrong username or password." }; }
      fails.delete(userKey);
      const token = crypto.randomBytes(32).toString("base64url"), csrf = crypto.randomBytes(24).toString("base64url");
      sessions.set(token, { user: user.name, role: user.role, csrf, exp: now() + SESSION_MS });
      return { ok: true, token, user: user.name, role: user.role, csrf, maxAge: SESSION_MS / 1000 };
    },
    session(req) {
      const m = /(?:^|;\s*)maruf_admin=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || "");
      if (!m) return null;
      const s = sessions.get(m[1]);
      if (!s || s.exp < now()) { sessions.delete(m[1]); return null; }
      return { token: m[1], ...s };
    },
    logout(token) { sessions.delete(token); },
    /** Changes must come from our own pages: right token, and an Origin (when sent) that matches the host. */
    csrfOk(req, session) {
      const header = String(req.headers["x-csrf-token"] || "");
      if (!header || header.length !== session.csrf.length || !crypto.timingSafeEqual(Buffer.from(header), Buffer.from(session.csrf))) return false;
      const origin = req.headers.origin;
      if (origin) { try { if (new URL(origin).host !== req.headers.host) return false; } catch { return false; } }
      return true;
    },
    cookie(token, secure, maxAge) { return `maruf_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`; },
    clearCookie(secure) { return `maruf_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`; },
  };
}

export const can = { viewRequests: (role) => role === "owner" || role === "staff", editRequests: (role) => role === "owner" || role === "staff", manageSite: (role) => role === "owner" };
