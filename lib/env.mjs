// Settings kept in a file called .env next to server.mjs (made by `npm run setup`, or by hand from .env.example).
// A setting that is already set in the real environment (a host's settings page) always wins over the file.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** NAME=value lines in, an object out. Understands # comments, blank lines and 'single' or "double" quotes. */
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    if ((q === '"' || q === "'") && v.indexOf(q, 1) > 0) v = v.slice(1, v.indexOf(q, 1));
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v;
  }
  return out;
}

/** Text for a value that survives parseEnv: bare when plain, quoted when it has spaces or a #. Returns null for a value that cannot be stored on one line. */
export function envValue(v) {
  const s = String(v);
  if (/[\r\n]/.test(s)) return null;
  if (/^[A-Za-z0-9_./:@+,%=-]*$/.test(s)) return s;
  if (!s.includes('"')) return `"${s}"`;
  if (!s.includes("'")) return `'${s}'`;
  return null;
}

/** Put the settings from <dir>/.env into env, without replacing any that are already set. Returns the names it added. */
export function loadDotEnv(dir, env = process.env) {
  const file = path.join(dir, ".env");
  if (!existsSync(file)) return [];
  const added = [];
  for (const [k, v] of Object.entries(parseEnv(readFileSync(file, "utf8")))) if (env[k] === undefined && v !== "") { env[k] = v; added.push(k); }
  return added;
}
