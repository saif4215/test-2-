// Shared by the server tests: start a real server on a free port with its own temporary data folder.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "./server.mjs";
import { todayNY } from "./lib/forms.mjs";

/** A date `days` from today in New York, as YYYY-MM-DD. Tests never use fixed dates, which would go stale. */
export function inDays(days) {
  const [y, m, d] = todayNY().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

export const goodOrder = () => ({ fullName: "Sam Lee", phone: "(929) 555-0101", email: "sam@example.com", dateNeeded: inDays(30), fulfillment: "pickup", people: "40", foodItems: "6 trays of chicken, 2 of rice", pickupTime: "17:30" });
export const goodEvent = () => ({ name: "Ana", phone: "9295550102", email: "ana@example.com", eventType: "Birthday party", eventDate: inDays(45), guests: "30", needFood: "yes", venueType: "full-venue" });

/** A tiny server that records what it receives (stands in for Resend and a webhook). */
export async function hookServer(status = 200) {
  const hooks = [];
  const s = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    hooks.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    res.statusCode = status; res.end("{}");
  });
  await new Promise((r) => s.listen(0, r));
  return { hooks, unref: () => s.unref(), url: `http://localhost:${s.address().port}`, close: () => s.close() };
}

/** Start the site. Returns helpers; call close() when done. `extra` overrides or adds environment settings. */
export async function startSite(extra = {}, { notify = true } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "maruf-"));
  const hook = await hookServer();
  const env = {
    DATA_DIR: dir, INQUIRY_RATE_LIMIT_PER_MIN: "1000", RATE_LIMIT_PER_MIN: "1000",
    ...(notify ? { INQUIRY_WEBHOOK_URL: `${hook.url}/hook`, RESEND_API_KEY: "rk", NOTIFY_EMAIL: "owner@example.com", RESEND_API_BASE: `${hook.url}/email` } : {}),
    ADMIN_PASSWORD: "owner-pass-12345", STAFF_PASSWORD: "staff-pass-12345", ...extra,
  };
  const server = createServer(env);
  await new Promise((r) => server.listen(0, r));
  server.unref(); hook.unref();   // a failing test must not keep the process alive
  const u = `http://localhost:${server.address().port}`;
  const json = async (r) => ({ status: r.status, json: await r.json().catch(() => null), headers: r.headers });
  const api = {
    u, dir, hooks: hook.hooks,
    post: (b) => fetch(u + "/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(json),
    /** Sign in; returns a client that sends the cookie and CSRF token. */
    async login(username = "owner", password = "owner-pass-12345") {
      const r = await fetch(u + "/admin/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const j = await r.json();
      if (!j.ok) return { ok: false, status: r.status, json: j };
      const cookie = r.headers.get("set-cookie").split(";")[0];
      const call = (method, route, body, headers = {}) => fetch(`${u}/admin/api/${route}`, {
        method, headers: { Cookie: cookie, "X-CSRF-Token": j.csrf, ...(body !== undefined && !Buffer.isBuffer(body) ? { "Content-Type": "application/json" } : {}), ...headers },
        body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
      }).then(json);
      return { ok: true, cookie, csrf: j.csrf, setCookie: r.headers.get("set-cookie"), call, get: (route) => call("GET", route), put: (route, b) => call("PUT", route, b), patch: (route, b) => call("PATCH", route, b), del: (route) => call("DELETE", route) };
    },
    close() { server.close(); hook.close(); rmSync(dir, { recursive: true, force: true }); },
  };
  return api;
}
