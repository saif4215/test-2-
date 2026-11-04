// One command to try the app on a real phone with Expo Go:   npm run phone
// It starts the café's server on this computer (with empty, throwaway data, so test orders and requests never mix with real ones),
// then starts Expo with the server's address built in, so the chat, ordering and request forms work on the phone too.
// A QR code appears in the terminal: scan it with the Camera app on an iPhone, or with the Expo Go app on Android.
// The phone must be on the same Wi-Fi as this computer. Options:
//   --tunnel        let a phone on any network open the app (needs access to expo.dev and ngrok.com; the chat and ordering then need a deployed server, see below)
//   --no-server     do not start the café's server: use the one in EXPO_PUBLIC_API_URL (for example your deployed one)
//   --host 1.2.3.4  use this address for this computer instead of guessing it
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "app");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const win = process.platform === "win32";
const say = (s = "") => console.log(s);

/** This computer's address on the local network: the one a phone on the same Wi-Fi can reach. */
export function lanAddress(interfaces = os.networkInterfaces()) {
  const all = Object.values(interfaces).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  const rank = (a) => (/^192\.168\./.test(a) ? 0 : /^10\./.test(a) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 3);
  return all.sort((a, b) => rank(a) - rank(b))[0] || "";
}

const free = (port) => new Promise((resolve) => { const s = net.createServer(); s.once("error", () => resolve(false)); s.once("listening", () => s.close(() => resolve(true))); s.listen(port, "0.0.0.0"); });
async function pickPort(want) {
  if (await free(want)) return want;
  return new Promise((resolve) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}
const run = (cmd, a, opts = {}) => spawn(cmd, a, { stdio: "inherit", shell: win, ...opts });

async function main() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) { say(`This needs Node 22.12 or newer (this is ${process.versions.node}). Get it from nodejs.org, then run this again.`); process.exit(1); }

  const hostArg = args.indexOf("--host") >= 0 ? args[args.indexOf("--host") + 1] : "";
  const host = hostArg || lanAddress();
  const tunnel = flag("--tunnel");
  if (!host && !tunnel) { say("I could not find this computer's address on your network. Connect to Wi-Fi, or run:  npm run phone -- --host YOUR.COMPUTER.IP"); process.exit(1); }

  if (!existsSync(path.join(APP, "node_modules"))) {
    say("Installing the app's packages the first time (a few minutes)...");
    await new Promise((res, rej) => run(win ? "npm.cmd" : "npm", ["install"], { cwd: APP }).on("exit", (c) => (c === 0 ? res() : rej(new Error("npm install failed")))));
  }

  const children = [];
  let tmp = "";
  const stop = (code = 0) => { for (const c of children) { try { c.kill(); } catch { /* already gone */ } } if (tmp) { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* leave it */ } } process.exit(code); };
  process.on("SIGINT", () => stop(0)); process.on("SIGTERM", () => stop(0));

  let apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
  if (!flag("--no-server")) {
    const port = await pickPort(Number(process.env.PORT) || 8080);
    tmp = mkdtempSync(path.join(os.tmpdir(), "maruf-phone-"));
    const server = spawn(process.execPath, [path.join(ROOT, "server.mjs")], { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, PORT: String(port), DATA_DIR: tmp, NODE_NO_WARNINGS: "1" } });
    children.push(server);
    server.on("exit", (c) => { if (c) { say("The café's server stopped."); stop(1); } });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/config`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 200)); }
    apiUrl = `http://${host || "127.0.0.1"}:${port}`;
    say(`The café's server is running on this computer (${apiUrl}). It uses empty throwaway data.`);
  }

  say();
  say("Next: install Expo Go on your phone (App Store or Google Play), then scan the QR code below:");
  say("  iPhone: open the Camera app and point it at the code, then tap the Expo Go banner.");
  say("  Android: open Expo Go and tap Scan QR code.");
  say(tunnel ? "  Tunnel mode: the phone can be on any network, but it can only reach the café's server if EXPO_PUBLIC_API_URL is a public address." : `  Your phone must be on the same Wi-Fi as this computer (${host}).`);
  say("  Press Ctrl+C here when you are done.");
  say();

  const env = { ...process.env, ...(apiUrl ? { EXPO_PUBLIC_API_URL: apiUrl } : {}), ...(host && !tunnel ? { REACT_NATIVE_PACKAGER_HOSTNAME: host } : {}) };
  const expo = run(win ? "npx.cmd" : "npx", ["expo", "start", tunnel ? "--tunnel" : "--lan"], { cwd: APP, env });
  children.push(expo);
  expo.on("exit", (c) => stop(c || 0));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
