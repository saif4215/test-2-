// The public pages: filled with the owner's details, search data, nothing invented, nothing unescaped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startSite } from "./test-helpers.mjs";

const text = (r) => r.text();

test("the home page and both landing pages are served, with the right details filled in", async () => {
  const t = await startSite({ PUBLIC_URL: "https://cafe.example/" });
  for (const p of ["/", "/large-orders", "/rent-the-cafe", "/privacy", "/support"]) {
    const r = await fetch(t.u + p);
    assert.equal(r.status, 200, p);
    const html = await text(r);
    assert.doesNotMatch(html, /\{\{|<!--(HEAD|FAQ|REVIEWS|GALLERY|PACKAGES|VENUE|PHOTO)/, `${p}: every placeholder is filled`);
    assert.match(html, /tel:\+19293353296/, `${p}: phone link`);
  }
  const home = await text(await fetch(t.u + "/"));
  assert.match(home, /<link rel="canonical" href="https:\/\/cafe\.example\/">/);
  assert.match(home, /og:image" content="https:\/\/cafe\.example\/og-image\.png"/);
  assert.match(await text(await fetch(t.u + "/large-orders")), /canonical" href="https:\/\/cafe\.example\/large-orders"/);
  assert.match(await text(await fetch(t.u + "/large-orders")), /data-form="large-order"/);
  assert.match(await text(await fetch(t.u + "/rent-the-cafe")), /data-form="event"/);
  assert.equal((await fetch(t.u + "/og-image.png")).headers.get("content-type"), "image/png");
  t.close();
});

test("search data is built from real details only: no ratings, no reviews until real ones are added", async () => {
  const t = await startSite();
  const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const before = ld(await text(await fetch(t.u + "/")));
  const biz = before.find((x) => x["@type"] === "CafeOrCoffeeShop");
  assert.equal(biz.address.streetAddress, "365 Veterans Rd W"); assert.equal(biz.address.postalCode, "10309"); assert.equal(biz.telephone, "+19293353296");
  assert.equal(biz.aggregateRating, undefined); assert.equal(biz.review, undefined);
  assert.ok(before.some((x) => x["@type"] === "FAQPage"));
  assert.equal(biz.url, undefined, "no web address is invented when PUBLIC_URL is not set (localhost)");
  const a = await t.login();
  const c = (await a.get("content")).json.content;
  c.reviews = [{ name: "Jordan P.", source: "Google", text: "Great trays." }];
  await a.put("content", { content: c });
  const after = ld(await text(await fetch(t.u + "/"))).find((x) => x["@type"] === "CafeOrCoffeeShop");
  assert.equal(after.review.length, 1); assert.equal(after.aggregateRating, undefined);
  t.close();
});

test("home page sections for reviews and gallery exist only when there is something real to show", async () => {
  const t = await startSite();
  let html = await text(await fetch(t.u + "/"));
  assert.doesNotMatch(html, /id="reviews"|id="gallery"/);
  assert.match(html, /id="faq"/);
  const a = await t.login();
  const c = (await a.get("content")).json.content;
  c.reviews = [{ name: "Jordan P.", text: "Great trays.", source: "" }];
  await a.put("content", { content: c });
  html = await text(await fetch(t.u + "/"));
  assert.match(html, /id="reviews"/); assert.match(html, /Great trays\./);
  t.close();
});

test("anything the owner types is escaped on the public pages", async () => {
  const t = await startSite();
  const a = await t.login();
  const c = (await a.get("content")).json.content;
  c.faq = [{ q: "<img src=x onerror=alert(1)>?", a: "<script>alert(2)</script> & more" }];
  c.reviews = [{ name: "<b>Bob</b>", source: "", text: "<script>alert(3)</script>" }];
  c.venue.notes = '"><script>alert(4)</script>';
  c.packages[0].title = "<u>Basic</u>";
  assert.equal((await a.put("content", { content: c })).status, 200);
  for (const p of ["/", "/rent-the-cafe"]) {
    const html = await text(await fetch(t.u + p));
    assert.doesNotMatch(html, /<script>alert|<img src=x|<b>Bob|<u>Basic/, p);
  }
  const rent = await text(await fetch(t.u + "/rent-the-cafe"));
  assert.match(rent, /&lt;script&gt;alert\(4\)/);
  const jsonld = [...rent.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => m[1]).join("");
  assert.doesNotMatch(jsonld, /<script|<\/script/i, "search data cannot break out of its script tag");
  t.close();
});

test("venue facts and prices appear only after the owner fills them in", async () => {
  const t = await startSite();
  let rent = await text(await fetch(t.u + "/rent-the-cafe"));
  assert.doesNotMatch(rent, /venue-facts|class="price"/);
  const a = await t.login();
  const c = (await a.get("content")).json.content;
  c.venue.capacity = "Up to 40 seated"; c.venue.policies = "A deposit is required.";
  c.packages[1].price = "From $500";
  await a.put("content", { content: c });
  rent = await text(await fetch(t.u + "/rent-the-cafe"));
  assert.match(rent, /Up to 40 seated/); assert.match(rent, /A deposit is required\./); assert.match(rent, /From \$500/);
  t.close();
});

test("dashboard hours drive the opening-hours list and the search data", async () => {
  const t = await startSite();
  const a = await t.login();
  const c = (await a.get("content")).json.content;
  c.business.hours = [{ label: "Daily", days: [0, 1, 2, 3, 4, 5, 6], open: 8.5, close: 21 }];
  await a.put("content", { content: c });
  const html = await text(await fetch(t.u + "/"));
  assert.match(html, /<li data-days="0,1,2,3,4,5,6" data-open="8.5" data-close="21"><span>Daily<\/span><span>8:30 AM – 9 PM<\/span>/);
  assert.match(html, /"opens":"08:30","closes":"21:00"/);
  t.close();
});

test("robots.txt hides the dashboard, and sitemap.xml lists the public pages", async () => {
  const t = await startSite({ PUBLIC_URL: "https://cafe.example" });
  const robots = await text(await fetch(t.u + "/robots.txt"));
  assert.match(robots, /Disallow: \/admin\//); assert.match(robots, /Sitemap: https:\/\/cafe\.example\/sitemap\.xml/);
  const map = await text(await fetch(t.u + "/sitemap.xml"));
  for (const p of ["/", "/large-orders", "/rent-the-cafe"]) assert.ok(map.includes(`<loc>https://cafe.example${p}</loc>`), p);
  assert.doesNotMatch(map, /admin/);
  t.close();
  const local = await startSite();   // on localhost there is no real address to put in a sitemap
  assert.equal((await fetch(local.u + "/sitemap.xml")).status, 404);
  local.close();
});

test("the service worker never caches the dashboard", async () => {
  const t = await startSite();
  const sw = await text(await fetch(t.u + "/sw.js"));
  assert.match(sw, /startsWith\("\/admin"\)/);
  t.close();
});
