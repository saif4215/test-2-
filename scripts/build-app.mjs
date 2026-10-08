// Builds the phone app as a web app and puts it in public/app so server.mjs serves it at /app/.
//   npm run build        (used by the host, e.g. Render)
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "app"), DIST = path.join(APP, "dist"), OUT = path.join(ROOT, "public", "app");
// The live web app never shows "add a photo" boxes or "[ADD EMAIL]": a photo spot with no photo is simply left out.
const env = { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1", EXPO_OFFLINE: "1", EXPO_PUBLIC_SHOW_PLACEHOLDERS: "0" };
const run = (cmd, args) => execFileSync(cmd, args, { cwd: APP, stdio: "inherit", env, shell: process.platform === "win32" });

run("npm", ["install", "--no-audit", "--no-fund"]);
run("npx", ["expo", "export", "--platform", "web"]);

// Let people add it to their home screen: manifest, icon and colour.
const indexFile = path.join(DIST, "index.html");
let html = readFileSync(indexFile, "utf8");
const tags = [
  '<link rel="manifest" href="/app/manifest.webmanifest">',
  '<meta name="theme-color" content="#FBF8F2">',
  '<link rel="apple-touch-icon" href="/app/icon-180.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Maruf Cafe">',
].filter((t) => !html.includes(t.slice(0, 30))).join("");
html = html.replace("</head>", `${tags}</head>`);
writeFileSync(indexFile, html);

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
cpSync(DIST, OUT, { recursive: true });
console.log("Phone app built into public/app (served at /app/)");
