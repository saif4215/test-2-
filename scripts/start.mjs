// One command to run the café's server on this computer:   npm run go     (or double-click START.bat on Windows, START.command on a Mac)
// First time: it asks a few plain questions (scripts/setup.mjs) and saves the answers. Every time: it starts the server and opens the page.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadDotEnv } from "../lib/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Which page to open: the dashboard once a password is set, so the owner lands where the work is; otherwise the app. */
export function startPage(env, port) {
  return `http://localhost:${port}${env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 10 ? "/admin/" : "/app/"}`;
}

export function nodeTooOld(version = process.versions.node) {
  const [major, minor] = version.split(".").map(Number);
  return major < 22 || (major === 22 && minor < 13);
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref(); } catch { /* the address is printed anyway */ }
}

async function main() {
  if (nodeTooOld()) { console.log(`This needs Node 22.13 or newer (this is ${process.versions.node}). Get the "LTS" one from nodejs.org, install it, then start again.`); process.exit(1); }
  if (!existsSync(path.join(ROOT, ".env")) && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const a = (await rl.question("First time here. Set it up now? It takes about a minute. (Y/n) ")).trim().toLowerCase();
    rl.close();
    if (!a.startsWith("n")) {
      const code = await new Promise((resolve) => spawn(process.execPath, [path.join(ROOT, "scripts", "setup.mjs")], { stdio: "inherit" }).on("exit", resolve));
      if (code !== 0) process.exit(code || 1);
    }
  }
  loadDotEnv(ROOT);
  const port = Number(process.env.PORT) || 8080;
  const server = spawn(process.execPath, [path.join(ROOT, "server.mjs")], { cwd: ROOT, stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  server.on("exit", (code) => process.exit(code ?? 0));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { try { server.kill(); } catch { /* gone */ } process.exit(0); });
  const url = startPage(process.env, port);
  setTimeout(() => { console.log(`\nOpening ${url}\nLeave this window open while the café's server is running. Close it, or press Ctrl+C, to stop.\n`); openBrowser(url); }, 1200);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
