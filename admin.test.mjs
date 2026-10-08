// Staff dashboard: sign-in, permissions, CSRF, request statuses, menu, content, photos, export.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startSite, goodOrder, goodEvent } from "./test-helpers.mjs";

// A 1x1 PNG and a tiny JPEG header + padding, enough for the magic-byte check.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);

test("the dashboard is off, and says so, when no password is set", async () => {
  const t = await startSite({ ADMIN_PASSWORD: "", STAFF_PASSWORD: "" });
  const r = await fetch(t.u + "/admin/api/me");
  assert.equal(r.status, 404);
  t.close();
});

test("a password shorter than 10 characters switches that account off", async () => {
  const t = await startSite({ ADMIN_PASSWORD: "short", STAFF_PASSWORD: "staff-pass-12345" });
  assert.equal((await t.login("owner", "short")).status, 401);
  assert.equal((await t.login("staff", "staff-pass-12345")).ok, true);
  t.close();
});

test("sign-in: wrong passwords fail, the right one sets a locked-down cookie", async () => {
  const t = await startSite();
  const bad = await t.login("owner", "wrong-password");
  assert.equal(bad.ok, false); assert.equal(bad.status, 401);
  const good = await t.login();
  assert.equal(good.ok, true);
  assert.match(good.setCookie, /HttpOnly/); assert.match(good.setCookie, /SameSite=Strict/); assert.doesNotMatch(good.setCookie, /Secure/);
  const https = await fetch(t.u + "/admin/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" }, body: JSON.stringify({ username: "owner", password: "owner-pass-12345" }) });
  assert.match(https.headers.get("set-cookie"), /; Secure/);
  t.close();
});

test("too many wrong passwords lock sign-in for a while", async () => {
  const t = await startSite();
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await t.login("owner", `wrong-${i}`)).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
  assert.equal((await t.login()).status, 429, "even the right password waits");
  t.close();
});

test("nothing in the dashboard API works without signing in", async () => {
  const t = await startSite();
  for (const [m, route] of [["GET", "me"], ["GET", "inquiries"], ["GET", "inquiries.csv"], ["GET", "menu"], ["PUT", "menu"], ["GET", "content"], ["PUT", "content"], ["GET", "uploads"], ["POST", "uploads"], ["GET", "audit"], ["GET", "status"]]) {
    const r = await fetch(`${t.u}/admin/api/${route}`, { method: m, body: m === "GET" ? undefined : "{}" });
    assert.equal(r.status, 401, `${m} ${route}`);
  }
  const forged = await fetch(`${t.u}/admin/api/me`, { headers: { Cookie: "maruf_admin=forged-token-value" } });
  assert.equal(forged.status, 401);
  t.close();
});

test("changes need the CSRF token and a matching origin", async () => {
  const t = await startSite();
  await t.post({ type: "event", fields: goodEvent() });
  const a = await t.login();
  const id = (await a.get("inquiries")).json.rows[0].id;
  const send = (headers) => fetch(`${t.u}/admin/api/inquiries/${id}`, { method: "PATCH", headers: { Cookie: a.cookie, "Content-Type": "application/json", ...headers }, body: JSON.stringify({ status: "contacted" }) });
  assert.equal((await send({})).status, 403, "no token");
  assert.equal((await send({ "X-CSRF-Token": "wrong" })).status, 403, "wrong token");
  assert.equal((await send({ "X-CSRF-Token": a.csrf, Origin: "https://evil.example" })).status, 403, "other site");
  assert.equal((await send({ "X-CSRF-Token": a.csrf, Origin: new URL(t.u).origin })).status, 200);
  t.close();
});

test("status and notes can be updated, and unknown statuses are refused", async () => {
  const t = await startSite();
  await t.post({ type: "large-order", fields: goodOrder() });
  const a = await t.login();
  const id = (await a.get("inquiries")).json.rows[0].id;
  assert.equal((await a.patch(`inquiries/${id}`, { status: "quote_sent", notes: "Sent quote by email" })).json.request.status, "quote_sent");
  assert.equal((await a.patch(`inquiries/${id}`, { status: "booked!" })).status, 400);
  assert.equal((await a.patch(`inquiries/${id}`, { notes: 5 })).status, 400);
  assert.equal((await a.patch(`inquiries/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}`, { status: "closed" })).status, 404);
  const detail = (await a.get(`inquiries/${id}`)).json.request;
  assert.equal(detail.status, "quote_sent"); assert.equal(detail.notes, "Sent quote by email"); assert.equal(detail.updatedBy, "owner");
  const list = (await a.get("inquiries?status=quote_sent")).json;
  assert.equal(list.total, 1); assert.equal(list.counts.quote_sent, 1); assert.equal(list.counts.new, 0);
  assert.equal((await a.get("inquiries?status=nope")).status, 400);
  assert.equal((await a.get("inquiries?type=event")).json.total, 0);
  assert.equal((await a.get("inquiries?q=Sam")).json.total, 1);
  assert.equal((await a.get("inquiries?q=%25")).json.total, 0, "search characters are not wildcards");
  t.close();
});

test("an accepted status is internal only: nothing is sent to the customer", async () => {
  const t = await startSite();
  await t.post({ type: "event", fields: goodEvent() });
  const before = t.hooks.length;
  const a = await t.login();
  const id = (await a.get("inquiries")).json.rows[0].id;
  await a.patch(`inquiries/${id}`, { status: "accepted" });
  assert.equal(t.hooks.length, before);
  t.close();
});

test("staff can work requests but cannot change the menu, content or photos", async () => {
  const t = await startSite();
  await t.post({ type: "event", fields: goodEvent() });
  const s = await t.login("staff", "staff-pass-12345");
  assert.equal((await s.get("inquiries")).json.total, 1);
  assert.equal((await s.get("inquiries.csv")).status, 200);
  const id = (await s.get("inquiries")).json.rows[0].id;
  assert.equal((await s.patch(`inquiries/${id}`, { status: "contacted" })).status, 200);
  for (const [m, route, body] of [["GET", "menu"], ["PUT", "menu", { menu: {} }], ["DELETE", "menu"], ["GET", "content"], ["PUT", "content", { content: {} }], ["GET", "uploads"], ["POST", "uploads", PNG], ["GET", "audit"], ["GET", "status"]]) {
    assert.equal((await s.call(m, route, body)).status, 403, `${m} ${route}`);
  }
  assert.equal((await fetch(t.u + "/menu.json").then((r) => r.json())).groups.Drinks.Coffee.length > 0, true);
  t.close();
});

test("with STAFF_CAN_EDIT_SITE=1 staff may also edit the site", async () => {
  const t = await startSite({ STAFF_CAN_EDIT_SITE: "1" });
  const s = await t.login("staff", "staff-pass-12345");
  assert.equal((await s.get("menu")).status, 200);
  assert.equal((await s.get("audit")).status, 403, "the audit trail stays with the owner");
  t.close();
});

test("signing out ends the session", async () => {
  const t = await startSite();
  const a = await t.login();
  assert.equal((await a.get("me")).status, 200);
  assert.equal((await a.call("POST", "logout", {})).status, 200);
  assert.equal((await a.get("me")).status, 401);
  t.close();
});

test("the request list can be exported as a spreadsheet, safely", async () => {
  const t = await startSite();
  await t.post({ type: "large-order", fields: { ...goodOrder(), foodItems: '=HYPERLINK("http://evil","click")', specialRequests: "Line one\nLine, two" } });
  const a = await t.login();
  const r = await fetch(`${t.u}/admin/api/inquiries.csv`, { headers: { Cookie: a.cookie } });
  assert.match(r.headers.get("content-type"), /text\/csv/); assert.match(r.headers.get("content-disposition"), /attachment/);
  const csv = await r.text();
  assert.match(csv, /'=HYPERLINK/); assert.doesNotMatch(csv, /,=HYPERLINK/);
  assert.match(csv, /"Line one\nLine, two"/);
  t.close();
});

/* ---------------- menu ---------------- */
test("menu edits change the public menu, and hidden items cannot be bought", async () => {
  const sq = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    sq.calls.push({ url: req.url, json: raw ? JSON.parse(raw) : {} });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v2/orders") return res.end(JSON.stringify({ order: { id: "ORD1", version: 1, total_money: { amount: 1, currency: "USD" } } }));
    res.end(JSON.stringify({ payment: { id: "P", status: "COMPLETED" } }));
  });
  sq.calls = [];
  await new Promise((r) => sq.listen(0, r));
  const t = await startSite({ SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "l", SQUARE_APP_ID: "a", SQUARE_API_BASE: `http://localhost:${sq.address().port}` });
  const a = await t.login();
  const menu = (await a.get("menu")).json.menu;
  const latte = menu.groups.Drinks.Coffee.find((i) => i.id === "drinks-coffee-latte");
  latte.cents = 999;
  menu.groups.Drinks.Coffee.find((i) => i.id === "drinks-coffee-espresso") && (menu.groups.Drinks.Coffee.find((i) => i.id === "drinks-coffee-espresso").hidden = true);
  const put = await a.put("menu", { menu });
  assert.equal(put.status, 200);
  const pub = await (await fetch(t.u + "/menu.json")).json();
  assert.equal(pub.groups.Drinks.Coffee.find((i) => i.id === "drinks-coffee-latte").cents, 999);
  assert.equal(pub.groups.Drinks.Coffee.some((i) => i.id === "drinks-coffee-espresso"), false, "hidden items are not public");
  assert.equal((await (await a.get("menu")).json.menu.groups.Drinks.Coffee.some((i) => i.id === "drinks-coffee-espresso")), true, "but the owner still sees them");
  const buy = (id) => fetch(t.u + "/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id, qty: 1 }], name: "Sam", sourceId: "cnon:x", idempotencyKey: "11111111-2222-3333-4444-555555555555" }) });
  assert.equal((await buy("drinks-coffee-latte")).status, 200);
  assert.equal(sq.calls[0].json.order.line_items[0].base_price_money.amount, 999, "checkout uses the new price");
  assert.equal((await buy("drinks-coffee-espresso")).status, 400, "hidden item is refused");
  // reset
  assert.equal((await a.del("menu")).status, 200);
  assert.equal((await (await fetch(t.u + "/menu.json")).json()).groups.Drinks.Coffee.find((i) => i.id === "drinks-coffee-latte").cents, 450);
  sq.close(); t.close();
});

test("menu validation explains what is wrong and saves nothing", async () => {
  const t = await startSite();
  const a = await t.login();
  const bad = (menu) => a.put("menu", { menu });
  const noName = await bad({ groups: { Food: { Burgers: [{ id: "x", cents: 500 }] } } });
  assert.equal(noName.status, 400); assert.match(noName.json.error, /no name/);
  const noPrice = await bad({ groups: { Food: { Burgers: [{ name: "Free burger", cents: -5 }] } } });
  assert.match(noPrice.json.error, /valid price/);
  const decimals = await bad({ groups: { Food: { Burgers: [{ name: "Half", cents: 5.5 }] } } });
  assert.equal(decimals.status, 400);
  assert.equal((await bad({ nothing: 1 })).status, 400);
  assert.equal((await bad(undefined)).status, 400);
  assert.equal((await a.get("menu")).json.custom, false);
  const ok = await bad({ groups: { Food: { Burgers: [{ name: "Test Burger", cents: 1200 }, { name: "Test Burger", min: 100, max: 200 }] } } });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.menu.groups.Food.Burgers.map((i) => i.id), ["food-burgers-test-burger", "food-burgers-test-burger-2"], "ids stay unique");
  t.close();
});

/* ---------------- content, SEO ---------------- */
test("content edits are cleaned, and links and photos can only be safe ones", async () => {
  const t = await startSite();
  const a = await t.login();
  const content = (await a.get("content")).json.content;
  content.business.email = "hello@example.com";
  content.business.instagram = "javascript:alert(1)";
  content.business.tiktok = "https://www.tiktok.com/@marufsi1";
  content.venue.capacity = "Up to 40 seated";
  content.faq.push({ q: "Do you have parking?", a: "Ask us." });
  content.gallery = [{ url: "https://evil.example/x.png", alt: "Remote photo" }, { url: "javascript:alert(1)", alt: "Bad" }];
  const put = await a.put("content", { content });
  assert.equal(put.status, 200);
  const pub = await (await fetch(t.u + "/content.json")).json();
  assert.equal(pub.business.email, "hello@example.com");
  assert.equal(pub.business.instagram, "https://www.instagram.com/maruf.cafe/", "an unsafe link is dropped, so the default stays");
  assert.equal(pub.venue.capacity, "Up to 40 seated");
  assert.equal(pub.gallery.length, 1, "javascript: photo is dropped");
  assert.equal(pub.faq.at(-1).q, "Do you have parking?");
  t.close();
});

test("content validation gives plain messages", async () => {
  const t = await startSite();
  const a = await t.login();
  const base = (await a.get("content")).json.content;
  const tryIt = (mut) => { const c = structuredClone(base); mut(c); return a.put("content", { content: c }); };
  assert.match((await tryIt((c) => { c.business.email = "not an email"; })).json.error, /email/i);
  assert.match((await tryIt((c) => { c.business.hours[0].close = 3; })).json.error, /hours/i);
  assert.match((await tryIt((c) => { c.gallery = [{ url: "https://example.com/a.jpg", alt: "" }]; })).json.error, /description/i);
  assert.equal((await a.put("content", {})).status, 400);
  t.close();
});

/* ---------------- photos ---------------- */
test("photos: real images are accepted, everything else is refused", async () => {
  const t = await startSite();
  const a = await t.login();
  const up = await a.call("POST", "uploads", PNG, { "Content-Type": "image/png", "X-Filename": "my%20photo.png" });
  assert.equal(up.status, 200); assert.match(up.json.upload.url, /^\/uploads\/[0-9a-f-]+\.png$/);
  const img = await fetch(t.u + up.json.upload.url);
  assert.equal(img.status, 200); assert.equal(img.headers.get("content-type"), "image/png"); assert.equal(img.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG);
  assert.equal((await a.call("POST", "uploads", JPG, { "Content-Type": "image/jpeg" })).status, 200);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal((await a.call("POST", "uploads", svg, { "Content-Type": "image/svg+xml" })).status, 400, "svg can carry scripts");
  assert.equal((await a.call("POST", "uploads", Buffer.from("<html>not an image</html>"), { "Content-Type": "image/png", "X-Filename": "x.png" })).status, 400, "the name does not decide");
  assert.equal((await a.call("POST", "uploads", Buffer.concat([PNG, Buffer.alloc(7 * 1024 * 1024)]), { "Content-Type": "image/png" })).status, 413);
  assert.equal((await fetch(t.u + "/uploads/not-uploaded.png")).status, 404);
  assert.equal((await fetch(t.u + "/uploads/..%2fmaruf.db")).status, 404);
  assert.equal((await a.get("uploads")).json.uploads.length, 2);
  t.close();
});

test("a photo that the site uses cannot be deleted until it is removed from the page", async () => {
  const t = await startSite();
  const a = await t.login();
  const up = (await a.call("POST", "uploads", PNG, { "Content-Type": "image/png" })).json.upload;
  const content = (await a.get("content")).json.content;
  content.photos.interior = up.url;
  assert.equal((await a.put("content", { content })).status, 200);
  assert.equal((await a.del(`uploads/${up.id}`)).status, 409);
  delete content.photos.interior;
  await a.put("content", { content });
  assert.equal((await a.del(`uploads/${up.id}`)).status, 200);
  assert.equal((await fetch(t.u + up.url)).status, 404);
  t.close();
});

test("the audit trail records who changed what, without passwords", async () => {
  const t = await startSite();
  const a = await t.login();
  await a.put("menu", { menu: (await a.get("menu")).json.menu });
  const log = (await a.get("audit")).json.entries;
  assert.ok(log.some((e) => e.action === "menu.save" && e.user === "owner"));
  assert.doesNotMatch(JSON.stringify(log), /owner-pass|staff-pass/);
  t.close();
});

test("status check reports setup without revealing any secret", async () => {
  const t = await startSite();
  const a = await t.login();
  const raw = JSON.stringify((await a.get("status")).json);
  assert.doesNotMatch(raw, /owner-pass|staff-pass|"rk"|owner@example/);
  const s = JSON.parse(raw);
  assert.equal(s.email, true); assert.equal(s.webhook, true); assert.equal(s.square, "off");
  t.close();
});

test("the dashboard page is locked down and the old requests page moves there", async () => {
  const t = await startSite();
  const page = await fetch(t.u + "/admin/");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  assert.match(page.headers.get("x-robots-tag"), /noindex/);
  assert.equal(page.headers.get("cache-control"), "no-store");
  const old = await fetch(t.u + "/admin/requests", { redirect: "manual" });
  assert.equal(old.status, 301); assert.equal(old.headers.get("location"), "/admin/");
  t.close();
});
