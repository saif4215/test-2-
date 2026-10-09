// The pages that remain next to the app: privacy and support (filled with the café's details), robots and sitemap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";

const text = (r) => r.text();

test("privacy and support pages show the café's own details and no leftover placeholders", async () => {
  const t = await startSite();
  for (const p of ["/privacy", "/support"]) {
    const r = await fetch(t.u + p);
    assert.equal(r.status, 200, p);
    const html = await text(r);
    assert.doesNotMatch(html, /\{\{|<!--/, `${p}: every placeholder is filled`);
    assert.match(html, /tel:\+19293353296/); assert.match(html, /365 Veterans Rd W/);
  }
  const support = await text(await fetch(t.u + "/support"));
  assert.match(support, /\[ADD EMAIL\]/, "until an email is set, the page says so instead of inventing one");
  assert.doesNotMatch(support, /website/i, "no mention of the removed website");
  const a = await t.login();
  const c = (await a.get("content")).json.content;
  c.business.email = "hello@example.com"; c.business.phone = "(718) 555-0100"; c.business.phoneTel = "+17185550100";
  await a.put("content", { content: c });
  const after = await text(await fetch(t.u + "/privacy"));
  assert.match(after, /hello@example\.com/); assert.match(after, /\(718\) 555-0100/);
  t.close();
});

test("privacy page covers the AI chat and directions, in plain words", async () => {
  const t = await startSite();
  const html = await text(await fetch(t.u + "/privacy"));
  assert.match(html, /AI assistant/); assert.match(html, /Get directions/); assert.doesNotMatch(html, /embedded|shows a Google map/i);
  t.close();
});

test("robots.txt hides the dashboard, and sitemap.xml lists the app and policy pages", async () => {
  const t = await startSite({ PUBLIC_URL: "https://cafe.example" });
  const robots = await text(await fetch(t.u + "/robots.txt"));
  assert.match(robots, /Disallow: \/admin\//); assert.match(robots, /Sitemap: https:\/\/cafe\.example\/sitemap\.xml/);
  const map = await text(await fetch(t.u + "/sitemap.xml"));
  for (const p of ["/app/", "/privacy", "/support"]) assert.ok(map.includes(`<loc>https://cafe.example${p}</loc>`), p);
  assert.doesNotMatch(map, /admin/);
  t.close();
  const local = await startSite();
  assert.equal((await fetch(local.u + "/sitemap.xml")).status, 404);
  local.close();
});
