// Checks your Square settings, in plain words, without placing a real order:   npm run square-check
//   npm run square-check -- --order    also sends ONE test order through the app's own server (only allowed in sandbox, never production)
// It reads SQUARE_ENV, SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID from this computer's environment or from a file named .env in this folder
// (copy .env.example to .env and fill it in; git ignores .env). The token is never printed.
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, SQUARE_VERSION } from "../server.mjs";
import { fetchCatalog } from "../lib/square-catalog.mjs";
import { checkoutIndex } from "../lib/menu.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** KEY=value lines (a # comment after the value is allowed). */
export function parseEnvFile(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim();
    const quoted = /^(["'])(.*?)\1/.exec(v);
    out[m[1]] = quoted ? quoted[2] : v.replace(/\s+#.*$/, "").trim();
  }
  return out;
}

const money = (c) => `$${(c / 100).toFixed(2)}`;

/**
 * Run the checks. Returns { ok, lines: [{ ok, text, fix? }] }. `env` is the settings; `order: true` also places a sandbox test order.
 * Nothing here ever includes the access token.
 */
export async function checkSquare(env, { order = false } = {}) {
  const lines = [];
  const add = (ok, text, fix) => { lines.push({ ok, text, ...(fix ? { fix } : {}) }); return ok; };
  const production = env.SQUARE_ENV === "production";
  const base = env.SQUARE_API_BASE || (production ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com");
  const token = env.SQUARE_ACCESS_TOKEN || "", locationId = env.SQUARE_LOCATION_ID || "";

  if (!token || !locationId) {
    add(false, `Missing: ${[!token && "SQUARE_ACCESS_TOKEN", !locationId && "SQUARE_LOCATION_ID"].filter(Boolean).join(" and ")}.`, "Put them in the .env file (copy .env.example to .env) or in your host's environment settings.");
    return { ok: false, lines };
  }
  add(true, `Settings found. Mode: ${production ? "PRODUCTION (real orders)" : "sandbox (test orders)"}.`);
  if (env.SQUARE_ENV && !["sandbox", "production"].includes(env.SQUARE_ENV)) add(false, `SQUARE_ENV is "${env.SQUARE_ENV}", which counts as sandbox.`, 'Use exactly "sandbox" or "production".');

  // 1. is the token good, and is this location in the account
  let locations;
  try {
    const res = await fetch(`${base}/v2/locations`, { headers: { Authorization: `Bearer ${token}`, "Square-Version": SQUARE_VERSION }, signal: AbortSignal.timeout(10000) });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) { add(false, "Square did not accept the access token.", `A ${production ? "Production" : "Sandbox"} token goes with SQUARE_ENV=${production ? "production" : "sandbox"}. Check that the token and SQUARE_ENV match, and that you copied the whole token.`); return { ok: false, lines }; }
    if (!res.ok) { add(false, `Square answered ${res.status} ${json.errors?.[0]?.code || ""} when listing locations.`, json.errors?.[0]?.detail || "Check the token's permissions in the Developer Dashboard."); return { ok: false, lines }; }
    locations = json.locations || [];
    add(true, "Square accepted the access token.");
  } catch {
    add(false, "Could not reach Square from this computer.", "Check the internet connection.");
    return { ok: false, lines };
  }
  const loc = locations.find((l) => l.id === locationId);
  if (!loc) {
    add(false, `The location ID ${locationId} is not in this Square account.`, locations.length ? `Locations in this account: ${locations.map((l) => `${l.name || "(no name)"} = ${l.id}`).join("; ")}.` : "This account has no locations.");
    return { ok: false, lines };
  }
  add(true, `Location: ${loc.name || "(no name)"}${loc.status ? ` (${loc.status.toLowerCase()})` : ""}.`);
  if (loc.status && loc.status !== "ACTIVE") add(false, "This location is not active, so Square may refuse orders for it.", "Open it in the Square Dashboard under Account & Settings, Business, Locations.");
  if (loc.currency && loc.currency !== "USD") add(false, `This location uses ${loc.currency}, but the app prices everything in USD.`, "Use the café's US location.");

  // 2. the café's item list, read only (used by the chat)
  try {
    const items = await fetchCatalog(base, token, SQUARE_VERSION, locationId);
    add(true, items.length ? `Item list: ${items.length} item${items.length === 1 ? "" : "s"} found in Square, so the chat can use them.` : "Item list: Square has no items for this location yet. Orders still work, and the chat uses the app's own menu.");
  } catch (err) {
    add(false, `Could not read the item list (${err.message}). Orders still work; the chat just uses the app's own menu.`, "If you want the chat to use your Square items, check that the token can read the catalog (ITEMS_READ).");
  }

  // 3. optionally, one trip through the app's own server
  if (order) {
    if (production) { add(false, "Not placing a test order: this is production, and a test order would be a real one.", "Switch to sandbox to test, or place one order yourself from your phone."); return { ok: false, lines }; }
    const server = createServer({ ...env, SQUARE_ENV: "sandbox", DATA_DIR: path.join(os.tmpdir(), `maruf-square-check-${process.pid}`), ORDER_RATE_LIMIT_PER_MIN: "1000" });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      const menu = await (await fetch(`${url}/menu.json`)).json();
      const first = [...checkoutIndex(menu)].find(([, v]) => v.cents > 0);
      if (!first) add(false, "The menu has no item with a single price to test with.");
      else {
        const key = `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 36);
        const body = { items: [{ id: first[0], qty: 1 }], name: "Square check", phone: "9295550100", note: "Test order from npm run square-check", idempotencyKey: key };
        const res = await fetch(`${url}/api/order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const placed = await res.json().catch(() => ({}));
        if (!res.ok || !placed.ok) add(false, `Square refused the test order: ${placed.error || res.status}.`, "The lines above this in the terminal show Square's error code. Send me that code and I will fix it.");
        else {
          add(true, `Test order sent: ${first[1].name}, code ${placed.ref}, total ${money(placed.totalCents)}.`);
          const back = await (await fetch(`${url}/api/order/${placed.orderId}`)).json().catch(() => ({}));
          add(!!back.ok, back.ok ? `The app can follow the order. Square says: ${back.status}.` : "The app could not look the order up again.");
          add(true, "Now open your Square Sandbox test account's Dashboard, go to Orders, and look for it (source: Maruf Cafe app).");
        }
      }
    } finally { server.close(); }
  }
  return { ok: lines.every((l) => l.ok), lines };
}

async function main() {
  const file = path.join(ROOT, ".env");
  const fromEnv = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith("SQUARE_") && v));
  const env = { ...(existsSync(file) ? parseEnvFile(readFileSync(file, "utf8")) : {}), ...fromEnv };
  const result = await checkSquare(env, { order: process.argv.includes("--order") });
  console.log();
  for (const l of result.lines) { console.log(`${l.ok ? "  OK   " : "  FIX  "}${l.text}`); if (l.fix) console.log(`         ${l.fix}`); }
  console.log(`\n${result.ok ? "Square looks ready." : "Not ready yet: fix the lines marked FIX, then run this again."}`);
  process.exit(result.ok ? 0 : 1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
