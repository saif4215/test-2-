// Quote and event requests: validation, storage, notifications, spam and failure behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startSite, hookServer, goodOrder, goodEvent, inDays } from "./test-helpers.mjs";

test("a large-order request is stored, sent to the webhook and emailed", async () => {
  const t = await startSite();
  const r = await t.post({ type: "large-order", fields: goodOrder(), website: "" });
  assert.equal(r.status, 200); assert.equal(r.json.ok, true);
  const hook = t.hooks.find((h) => h.url === "/hook"), mail = t.hooks.find((h) => h.url === "/email");
  assert.match(hook.body.text, /Number of people: 40/);
  assert.equal(mail.auth, "Bearer rk"); assert.deepEqual(mail.body.to, ["owner@example.com"]); assert.equal(mail.body.reply_to, "sam@example.com");
  assert.match(mail.body.subject, /Sam Lee.*40 people/); assert.match(mail.body.html, /Pickup/);
  const admin = await t.login();
  const list = await admin.get("inquiries");
  assert.equal(list.json.total, 1);
  assert.equal(list.json.rows[0].fields.people, "40");
  assert.equal(list.json.rows[0].status, "new");
  assert.equal(list.json.rows[0].notifyStatus, "sent");
  t.close();
});

test("an event request is accepted with only the required fields", async () => {
  const t = await startSite();
  assert.equal((await t.post({ type: "event", fields: goodEvent() })).status, 200);
  t.close();
});

test("the new quote fields are saved", async () => {
  const t = await startSite();
  const fields = { ...goodOrder(), fulfillment: "delivery", deliveryAddress: "12 Example St, Staten Island", contactMethod: "text", dietary: "Two guests are vegan", budget: "$800", alternateDate: undefined };
  assert.equal((await t.post({ type: "large-order", fields })).status, 200);
  const a = await t.login();
  const f = (await a.get("inquiries")).json.rows[0].fields;
  assert.equal(f.deliveryAddress, "12 Example St, Staten Island"); assert.equal(f.contactMethod, "text"); assert.equal(f.dietary, "Two guests are vegan"); assert.equal(f.budget, "$800");
  t.close();
});

test("missing or invalid fields are named so the form can highlight them", async () => {
  const t = await startSite();
  const r = await t.post({ type: "large-order", fields: { ...goodOrder(), email: "nope", people: "0", foodItems: "" } });
  assert.equal(r.status, 400);
  assert.deepEqual(r.json.fields.sort(), ["email", "foodItems", "people"]);
  assert.equal((await t.post({ type: "event", fields: { ...goodEvent(), eventDate: "tomorrow" } })).json.fields[0], "eventDate");
  assert.equal((await t.post({ type: "event", fields: { ...goodEvent(), eventDate: "2026-02-30" } })).status, 400);
  assert.equal((await t.post({ type: "nope", fields: {} })).status, 400);
  assert.equal((await t.post(null)).status, 400);
  assert.equal(t.hooks.length, 0, "nothing invalid is ever sent on");
  t.close();
});

test("dates in the past are rejected and today is allowed", async () => {
  const t = await startSite();
  assert.deepEqual((await t.post({ type: "event", fields: { ...goodEvent(), eventDate: inDays(-1) } })).json.fields, ["eventDate"]);
  assert.deepEqual((await t.post({ type: "large-order", fields: { ...goodOrder(), dateNeeded: inDays(-3) } })).json.fields, ["dateNeeded"]);
  assert.equal((await t.post({ type: "event", fields: { ...goodEvent(), eventDate: inDays(0) } })).status, 200);
  t.close();
});

test("delivery needs an address, and the end time must be after the start time", async () => {
  const t = await startSite();
  assert.deepEqual((await t.post({ type: "large-order", fields: { ...goodOrder(), fulfillment: "delivery" } })).json.fields, ["deliveryAddress"]);
  assert.deepEqual((await t.post({ type: "event", fields: { ...goodEvent(), startTime: "18:00", endTime: "17:00" } })).json.fields, ["endTime"]);
  assert.equal((await t.post({ type: "event", fields: { ...goodEvent(), startTime: "17:00", endTime: "21:00" } })).status, 200);
  t.close();
});

test("oversized text is cut and a huge body is refused", async () => {
  const t = await startSite();
  await t.post({ type: "large-order", fields: { ...goodOrder(), foodItems: "x".repeat(5000) } });
  const a = await t.login();
  assert.equal((await a.get("inquiries")).json.rows[0].fields.foodItems.length, 2000);
  const big = await fetch(t.u + "/api/inquiry", { method: "POST", body: "x".repeat(40000) });
  assert.equal(big.status, 413);
  t.close();
});

test("spam that fills the hidden field is dropped quietly", async () => {
  const t = await startSite();
  const r = await t.post({ type: "large-order", fields: goodOrder(), website: "http://spam.example" });
  assert.equal(r.status, 200);
  assert.equal(t.hooks.length, 0);
  assert.equal((await (await t.login()).get("inquiries")).json.total, 0);
  t.close();
});

test("a request is never reported as received when nothing could save or send it", async () => {
  const t = await startSite({ DATA_DIR: path.join(fileURLToPath(import.meta.url), "cannot-be-a-folder") }, { notify: false });
  const r = await t.post({ type: "large-order", fields: goodOrder() });
  assert.equal(r.status, 500);
  assert.match(r.json.error, /call us/i);
  t.close();
});

test("a stored request is still accepted when the email service is down, and the failure is recorded", async () => {
  const down = await hookServer(500);
  const t = await startSite({ INQUIRY_WEBHOOK_URL: "", RESEND_API_BASE: `${down.url}/email` });
  const r = await t.post({ type: "event", fields: goodEvent() });
  assert.equal(r.status, 200);
  const a = await t.login();
  assert.equal((await a.get("inquiries")).json.rows[0].notifyStatus, "failed");
  down.close(); t.close();
});

test("with no notification set up the request is still saved and the dashboard says so", async () => {
  const t = await startSite({}, { notify: false });
  assert.equal((await t.post({ type: "event", fields: goodEvent() })).status, 200);
  const a = await t.login();
  assert.equal((await a.get("inquiries")).json.rows[0].notifyStatus, "not_configured");
  const s = (await a.get("status")).json;
  assert.equal(s.email, false); assert.equal(s.webhook, false);
  t.close();
});

test("requests are limited per minute and CORS lets the phone app call the endpoint", async () => {
  const t = await startSite({ INQUIRY_RATE_LIMIT_PER_MIN: "2" });
  const pre = await fetch(t.u + "/api/inquiry", { method: "OPTIONS", headers: { Origin: "http://localhost:8081", "Access-Control-Request-Method": "POST" } });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get("access-control-allow-origin"), "*");
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await t.post({ type: "event", fields: goodEvent() })).status);
  assert.deepEqual(codes, [200, 200, 429]);
  t.close();
});

test("requests saved by the first version (inquiries.jsonl) are brought into the database once", async () => {
  const dir = path.join((await import("node:os")).tmpdir(), `maruf-legacy-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "inquiries.jsonl"), JSON.stringify({ id: "11111111-1111-1111-1111-111111111111", type: "event", title: "Event rental request", receivedAt: "2026-01-05T15:00:00.000Z", fields: { name: "Old Request", phone: "9295550100", email: "old@example.com", eventType: "Party", eventDate: "2026-02-01", guests: "10" }, labels: {} }) + "\n");
  const t = await startSite({ DATA_DIR: dir }, { notify: false });
  const a = await t.login();
  const rows = (await a.get("inquiries")).json.rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].fields.name, "Old Request");
  assert.ok(existsSync(path.join(dir, "inquiries.jsonl.imported")));
  t.close();
});
