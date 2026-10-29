// Packages the built phone app (public/app) so it can run on its own, with no server, inside a page that only hosts static files:
// a shared preview page, for example. Every button in the real app then works.
//
//   npm run build                                 # builds public/app
//   node scripts/make-preview.mjs <output-dir>    # writes <output-dir>/app/index.html and everything it needs
//
// What it changes in the copy (the built app itself is not touched):
//  - the app's file addresses are made relative to wherever app/index.html is served from;
//  - a small stand-in for the café's server answers the few things the app asks the server for: the menu and details,
//    the chat (using the same answers as the real server's keyless chat), "send a request" and "place an order" (nothing is actually sent;
//    a placed order moves through its steps by itself so the whole flow can be seen).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeContent, normalizeContent } from "../lib/content.mjs";
import { publicMenu } from "../lib/menu.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "app");
const out = process.argv[2] ? path.resolve(process.argv[2]) : "";
if (!out) { console.error("Usage: node scripts/make-preview.mjs <output-dir>"); process.exit(1); }
if (!existsSync(path.join(SRC, "index.html"))) { console.error("public/app is not built yet. Run: npm run build"); process.exit(1); }

const APP = path.join(out, "app");
rmSync(APP, { recursive: true, force: true });
mkdirSync(APP, { recursive: true });
cpSync(SRC, APP, { recursive: true });

// 1. the app's own files: "/app/assets/x" becomes "<where this page is>/assets/x"
const BASE = '(window.__MARUF_BASE||"/app/")';
const JS_DIR = path.join(APP, "_expo", "static", "js", "web");
let rewritten = 0;
for (const f of readdirSync(JS_DIR).filter((n) => n.endsWith(".js"))) {
  const file = path.join(JS_DIR, f);
  const text = readFileSync(file, "utf8");
  const next = text.replace(/"\/app\/(assets|_expo)\//g, (_, dir) => { rewritten++; return `${BASE}+"${dir}/`; });
  writeFileSync(file, next);
}
if (!rewritten) { console.error("Found no file addresses to rewrite in the built app: its build changed, so this script needs updating."); process.exit(1); }

// 2. the stand-in server
const menu = publicMenu(JSON.parse(readFileSync(path.join(ROOT, "public", "menu.json"), "utf8")));
const content = mergeContent(normalizeContent(JSON.parse(readFileSync(path.join(ROOT, "public", "content.default.json"), "utf8"))).content, undefined);
const { business, venue, faq, packages, packagesNote, featuredTitle, gallery, reviews, photos } = content;
const publicContent = { business, venue, faq, packages, packagesNote, featuredTitle, gallery, reviews, photos };

const answersSrc = readFileSync(path.join(ROOT, "lib", "answers.mjs"), "utf8").replace(/^import .*$/m, "").replace("export function basicAnswer", "function basicAnswer");
const fmtHourSrc = /export function fmtHour[\s\S]*?\n}\n/.exec(readFileSync(path.join(ROOT, "lib", "render.mjs"), "utf8"))[0].replace("export ", "");
// the stand-in must not contain "</script>" (it is a separate file, but keep it safe if it is ever inlined)
const shim = `// Stand-in for the café's server, for a preview that has no server. Written by scripts/make-preview.mjs: do not edit.
(function () {
  window.__MARUF_PREVIEW = true;
  var CONTENT = ${JSON.stringify(content)}, MENU = ${JSON.stringify(menu)}, PUBLIC_CONTENT = ${JSON.stringify(publicContent)};
  ${fmtHourSrc}
  ${answersSrc}
  var PRICE = {};
  Object.keys(MENU.groups).forEach(function (g) { Object.keys(MENU.groups[g]).forEach(function (c) { MENU.groups[g][c].forEach(function (it) { if (typeof it.cents === "number") PRICE[it.id] = it.cents; }); }); });
  var ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", placed = {};
  function refOf(key) { var h = 7, out = ""; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; for (var j = 0; j < 4; j++) { out += ALPHA[h % ALPHA.length]; h = Math.floor(h / ALPHA.length) + 17; } return out; }
  var realFetch = window.fetch.bind(window);
  function reply(obj, status) { return Promise.resolve(new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json" } })); }
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "", pathname = url;
    try { pathname = new URL(url, location.href).pathname; } catch (e) { /* keep the raw text */ }
    var method = ((init && init.method) || "GET").toUpperCase();
    if (pathname === "/content.json") return reply(PUBLIC_CONTENT);
    if (pathname === "/menu.json") return reply(MENU);
    if (pathname === "/api/assistant") {
      if (method === "GET") return reply({ enabled: true, mode: "basic" });
      var body = {}; try { body = JSON.parse(init.body); } catch (e) { /* no messages */ }
      return reply(Object.assign({ ok: true, mode: "basic" }, basicAnswer(CONTENT, MENU, body.messages || [], new Date(), { ordering: true })));
    }
    if (pathname === "/api/config") return reply({ enabled: true, environment: "sandbox", taxPercent: 0, maxOrderCents: 30000 });
    if (pathname === "/api/order" && method === "POST") {
      var order = {}; try { order = JSON.parse(init.body); } catch (e) { /* no order */ }
      var total = 0, id = "preview" + Date.now().toString(36);
      (order.items || []).forEach(function (it) { total += (PRICE[it.id] || 0) * (it.qty || 0); });
      placed[id] = { at: Date.now(), ref: refOf(String(order.idempotencyKey || id)), total: total };
      return reply({ ok: true, orderId: id, ref: placed[id].ref, totalCents: total, preview: true });
    }
    var progress = /^\/api\/order\/(preview\w+)$/.exec(pathname);
    if (progress) {
      var p = placed[progress[1]], age = p ? Date.now() - p.at : 0;
      return reply({ ok: true, status: age < 12000 ? "received" : age < 30000 ? "accepted" : "ready", ref: p ? p.ref : "", totalCents: p ? p.total : null });
    }
    if (pathname === "/api/inquiry" && method === "POST") return reply({ ok: true });   // a preview: nothing is stored or sent
    return realFetch(input, init);
  };
})();
`;
writeFileSync(path.join(APP, "preview-shim.js"), shim);

// 3. the page that starts the app
let html = readFileSync(path.join(APP, "index.html"), "utf8");
html = html
  .replace(/<link rel="(icon|manifest|apple-touch-icon)"[^>]*>/g, "")
  .replace(/(src|href)="\/app\//g, '$1="')   // the script files: relative to this page
  .replace("<head>", `<head>
    <script>window.__MARUF_BASE = location.pathname.replace(/[^\\/]*$/, "");</script>
    <script src="preview-shim.js"></script>`);
// the router expects the app at /app/: tell the browser that is where it is, once the app's script tags have been read
html = html.replace("</body>", `<script>try { history.replaceState(null, "", "/app/"); } catch (e) { /* the app then starts at whatever address it has */ }</script>\n  </body>`);
writeFileSync(path.join(APP, "index.html"), html);

const files = (function count(d) { return readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0); })(APP);
console.log(`Preview written to ${APP}: ${files} files, ${rewritten} file addresses made relative.`);
