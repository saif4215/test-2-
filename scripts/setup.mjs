// A few plain questions, then it saves your answers in a file called .env that the server reads when it starts.
//   npm run setup          (or just double-click START: it runs this the first time)
// Press Enter to skip a question or keep what is already saved. Passwords and keys you type stay on this computer: they are written
// only to .env, which is never uploaded (it is listed in .gitignore).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { envValue, parseEnv } from "../lib/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, ".env");

/** A password that is easy to read out loud: letters and digits, no look-alikes, 16 characters. */
export function makePassword(bytes = crypto.randomBytes(16)) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** The new .env text: every setting in `values` (blank ones left out), then any older settings this program does not know about, kept as they were. */
export function renderEnv(values, old = {}) {
  const lines = ["# Saved by `npm run setup`. Keep this file private: it holds your passwords and keys. Change it by running setup again, or edit it here.", ""];
  const seen = new Set();
  for (const [k, v] of Object.entries({ ...old, ...values })) {
    if (seen.has(k) || v === undefined || v === null || v === "") continue;
    seen.add(k);
    const t = envValue(v);
    if (t === null) throw new Error(`${k} cannot contain both a ' and a " (or a line break). Choose another value.`);
    lines.push(`${k}=${t}`);
  }
  return lines.join("\n") + "\n";
}

export async function runSetup({ ask, say = console.log, old = {}, password = makePassword } = {}) {
  const values = {};
  const keep = (k) => (old[k] ? "  (already saved: press Enter to keep it)" : "");
  const text = async (k, question, { min = 0 } = {}) => {
    for (;;) {
      const a = (await ask(`${question}${keep(k)} `)).trim();
      if (!a) { if (old[k]) values[k] = old[k]; return values[k] || ""; }
      if (a.length < min) { say(`  That is too short: it needs at least ${min} characters. Try again.`); continue; }
      if (envValue(a) === null) { say("  That cannot contain both a ' and a \" mark. Try another."); continue; }
      values[k] = a; return a;
    }
  };
  const yes = async (question, fallback = false) => {
    const a = (await ask(`${question} (${fallback ? "Y/n" : "y/N"}) `)).trim().toLowerCase();
    return a ? a.startsWith("y") : fallback;
  };

  say("");
  say("Maruf Cafe: quick setup. It takes about a minute. Press Enter to skip anything.");
  say("");

  say("1. Staff password");
  say("   You use it to sign in to the dashboard (the page where you see requests and change the menu).");
  if (old.ADMIN_PASSWORD) {
    const a = (await ask("   Press Enter to keep your password, or type a new one (10+ characters): ")).trim();
    if (!a) values.ADMIN_PASSWORD = old.ADMIN_PASSWORD;
    else if (a.length < 10 || envValue(a) === null) { say("   That one will not work (10+ characters, not both ' and \"), so I kept the old one."); values.ADMIN_PASSWORD = old.ADMIN_PASSWORD; }
    else values.ADMIN_PASSWORD = a;
  } else {
    const a = (await ask("   Type a password (10+ characters), or press Enter and I will make one: ")).trim();
    if (a && a.length >= 10 && envValue(a) !== null) values.ADMIN_PASSWORD = a;
    else { if (a) say("   That one will not work (10+ characters, not both ' and \"), so I made one for you."); values.ADMIN_PASSWORD = password(); say(`   Your password is:  ${values.ADMIN_PASSWORD}   (write it down; it is also saved in the .env file)`); }
  }
  say("");

  say("2. Be told when someone sends a request");
  say("   Without this you only see requests when you open the dashboard.");
  const hadEmail = Boolean(old.NOTIFY_EMAIL);
  if (await yes(hadEmail ? "   Keep emailing you each new request?" : "   Email me each new request?", hadEmail)) {
    await text("NOTIFY_EMAIL", "   Your email address:");
    await text("RESEND_API_KEY", "   Your Resend key (free at resend.com > API Keys):");
  } else if (hadEmail) { values.NOTIFY_EMAIL = ""; values.RESEND_API_KEY = ""; say("   Email alerts are off now."); }
  say("");

  say("3. Square (orders from the app go into your Square)");
  say("   Customers pay at the counter. You can skip this now and do it later: the app still works without it.");
  const hadSquare = Boolean(old.SQUARE_ACCESS_TOKEN);
  if (await yes(hadSquare ? "   Keep Square connected?" : "   Connect Square now?", hadSquare)) {
    say("   First try it with test orders only. Choose 'real' when you are ready to take real orders.");
    const real = await yes("   Real orders (not a test)?", old.SQUARE_ENV === "production");
    values.SQUARE_ENV = real ? "production" : "sandbox";
    say("   From developer.squareup.com > your application > Credentials (Sandbox or Production, to match what you chose):");
    await text("SQUARE_ACCESS_TOKEN", "   Access token:");
    await text("SQUARE_LOCATION_ID", "   Location ID (Square Developer Dashboard > Locations):");
    for (;;) {
      const a = (await ask(`   Sales tax in percent${old.TAX_PERCENT ? ` (saved: ${old.TAX_PERCENT})` : ""}. Staten Island is usually 8.875: check with your accountant. Type it, or Enter ${old.TAX_PERCENT ? "to keep" : "to leave blank"}: `)).trim();
      if (!a) { if (old.TAX_PERCENT) values.TAX_PERCENT = old.TAX_PERCENT; break; }
      if (Number.isFinite(Number(a)) && Number(a) >= 0 && Number(a) < 25) { values.TAX_PERCENT = a; break; }
      say("   Type just the number, for example 8.875.");
    }
  } else if (hadSquare) { for (const k of ["SQUARE_ENV", "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID", "TAX_PERCENT"]) values[k] = ""; say("   Square is disconnected now (the app goes back to sending requests only)."); }
  say("");

  say("4. Smarter chat (optional)");
  say("   An AI key makes the chat and the order helper smarter. Skip it if you do not have one; everything else works.");
  if (await yes("   Add an Anthropic key now?", Boolean(old.ANTHROPIC_API_KEY))) await text("ANTHROPIC_API_KEY", "   Your key (console.anthropic.com > API keys):");
  say("");

  return values;
}

async function main() {
  if (!process.stdin.isTTY) { console.log("Run this one by hand in a terminal:  npm run setup"); process.exit(1); }
  const old = existsSync(FILE) ? parseEnv(readFileSync(FILE, "utf8")) : {};
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const values = await runSetup({ ask: (q) => rl.question(q), old });
  rl.close();
  writeFileSync(FILE, renderEnv(values, old), { mode: 0o600 });
  console.log("Saved. Your settings are in the file called .env (keep it private).");
  console.log("To start the café's server, double-click START (or run:  npm run go)");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch((e) => { console.error(e.message); process.exit(1); });
