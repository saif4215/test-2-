import fs from "node:fs";
import { chromium } from "playwright-core";
import { startSite, inDays } from "../test-helpers.mjs";

const OUT = process.env.SHOTS_DIR || "/tmp";
const site = await startSite({ PUBLIC_URL: "" });
const b = await chromium.launch({ executablePath: ""+(process.env.CHROMIUM||"/opt/pw-browsers/chromium")+"" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const mk = async (w = 390, h = 844, mobile = true) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) fails.push("console: " + m.text()); });
  return { ctx, p };
};
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* ---------- mobile: every public page ---------- */
{
  const { ctx, p } = await mk(360, 740);
  for (const path of ["/", "/large-orders", "/rent-the-cafe", "/privacy", "/support"]) {
    await p.goto(site.u + path, { waitUntil: "load" });
    ok(await noOverflow(p), `${path}: no sideways scrolling at 360px`);
    if (path !== "/privacy" && path !== "/support") {
      const links = await p.$$eval(".mobile-bar a", (as) => as.map((a) => ({ t: a.textContent.trim(), h: a.getAttribute("href"), ht: a.getBoundingClientRect().height, v: a.getBoundingClientRect().width > 0 })));
      ok(links.length === 3 && links.every((l) => l.v && l.ht >= 44), `${path}: quick-action bar visible with big tap targets`);
      ok(links[0].h === "tel:+19293353296" && links[1].h === "/large-orders#request" && links[2].h === "/rent-the-cafe#request", `${path}: Call / Large orders / Rent the café links are right`);
    }
  }
  await p.goto(site.u + "/", { waitUntil: "load" });
  await p.waitForTimeout(800);
  const bar = await p.$eval(".mobile-bar", (e) => { const r = e.getBoundingClientRect(); return { top: r.top, h: innerHeight }; });
  ok(Math.abs(bar.top + 56 - bar.h) < 20 || bar.top < bar.h, "bar sits at the bottom of the screen");
  ok((await p.locator("#faq details").count()) >= 5, "FAQ shown on the home page");
  ok((await p.locator("#reviews").count()) === 0 && (await p.locator("#gallery").count()) === 0, "no reviews or gallery shown when there are none (nothing invented)");
  const ld = await p.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)));
  ok(ld.some((x) => x["@type"] === "CafeOrCoffeeShop" && x.address.postalCode === "10309" && !x.aggregateRating && !x.review) && ld.some((x) => x["@type"] === "FAQPage"), "search data present, with no made-up ratings or reviews");
  ok((await p.locator("#open-now").textContent()).match(/Open now|Closed/) !== null, "open-now badge works from the dashboard hours");
  await p.screenshot({ path: `${OUT}/up-home-m.png` });
  await p.locator("#large-orders").scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/up-home-sections-m.png` });
  await ctx.close();
}

/* ---------- large order form ---------- */
{
  const { ctx, p } = await mk();
  let posts = 0;
  p.on("request", (r) => { if (r.url().endsWith("/api/inquiry")) posts++; });
  await p.goto(site.u + "/large-orders", { waitUntil: "load" });
  await p.locator("#request").scrollIntoViewIfNeeded();
  await p.getByRole("button", { name: "Send my quote request" }).click();
  ok(posts === 0, "empty form sends nothing");
  ok((await p.locator(".err:visible").count()) >= 6, "empty form shows an error under each required field");
  ok(await p.evaluate(() => document.activeElement?.id === "f-fullName"), "focus moves to the first problem");
  await p.fill("#f-fullName", "Sam Lee");
  await p.fill("#f-phone", "123");
  await p.fill("#f-email", "sam@");
  await p.fill("#f-dateNeeded", inDays(-2));
  await p.fill("#f-people", "0");
  await p.getByRole("button", { name: "Send my quote request" }).click();
  const errs = await p.$$eval(".err:not([hidden])", (e) => e.map((x) => x.textContent));
  ok(errs.some((e) => /phone/i.test(e)) && errs.some((e) => /email/i.test(e)) && errs.some((e) => /date.*passed/i.test(e)) && errs.some((e) => /whole number/i.test(e)), "bad phone, email, past date and 0 people each get a clear message: " + errs.join(" | "));
  ok(posts === 0, "still nothing sent");
  await p.fill("#f-phone", "(929) 555-0101"); await p.fill("#f-email", "sam@example.com"); await p.fill("#f-dateNeeded", inDays(21)); await p.fill("#f-people", "40");
  ok(await p.locator('[data-field="deliveryAddress"]').isHidden(), "delivery address hidden until Delivery is chosen");
  await p.getByRole("radio", { name: "Delivery" }).check();
  ok(await p.locator('[data-field="deliveryAddress"]').isVisible(), "delivery address appears for Delivery");
  await p.fill("#f-foodItems", "6 trays of chicken and rice");
  await p.getByRole("button", { name: "Send my quote request" }).click();
  ok((await p.locator("#f-deliveryAddress-err").textContent()).match(/address/i) && posts === 0, "delivery without an address is stopped");
  await p.fill("#f-deliveryAddress", "12 Example St, Staten Island");
  await p.fill("#f-dietary", "One guest has a nut allergy");
  await p.screenshot({ path: `${OUT}/up-form-m.png`, fullPage: false });

  // server down: must not claim success, must keep the answers
  await p.route("**/api/inquiry", (r) => r.abort());
  await p.getByRole("button", { name: "Send my quote request" }).click();
  await p.locator(".form-banner.bad").waitFor();
  const txt = await p.locator(".form-banner.bad").textContent();
  ok(/not sent/i.test(txt) && (await p.locator(".form-banner.bad a[href^='tel:']").count()) === 1, "failure says it was NOT sent and offers the phone number");
  ok((await p.locator(".thanks").count()) === 0 && (await p.inputValue("#f-fullName")) === "Sam Lee", "no success message, and the typed answers are kept");
  await p.unroute("**/api/inquiry");
  await p.route("**/api/inquiry", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "We could not save your request. Please call us so we do not miss it." }) }));
  await p.getByRole("button", { name: "Send my quote request" }).click();
  await p.waitForTimeout(400);
  ok((await p.locator(".thanks").count()) === 0 && /call us/i.test(await p.locator(".form-banner.bad").textContent()), "a server error is shown, not hidden");
  await p.unroute("**/api/inquiry");

  await p.getByRole("button", { name: "Send my quote request" }).click();
  await p.locator(".thanks").waitFor();
  ok(/Thank you, Sam/.test(await p.locator(".thanks").textContent()) && /not a booking/i.test(await p.locator(".thanks").textContent()), "success only after the server saved it, and it says it is not a booking");
  await p.screenshot({ path: `${OUT}/up-thanks-m.png` });
  const a = await site.login();
  const rows = (await a.get("inquiries")).json.rows;
  ok(rows.length === 1 && rows[0].fields.deliveryAddress === "12 Example St, Staten Island" && rows[0].fields.dietary.includes("nut") && rows[0].fields.fulfillment === "delivery", "the request is in the database with all fields");
  ok(site.hooks.some((h) => h.url === "/email") && site.hooks.some((h) => h.url === "/hook"), "owner was notified by email and webhook");
  await ctx.close();
}

/* ---------- event form ---------- */
{
  const { ctx, p } = await mk();
  await p.goto(site.u + "/rent-the-cafe", { waitUntil: "load" });
  ok(!(await p.locator(".venue-facts").count()), "no capacity or rules shown until the owner adds them");
  ok((await p.locator(".package").count()) === 3 && (await p.locator(".package .price").count()) === 0, "options listed with no prices");
  await p.locator(".package a[data-package]").first().click();
  ok((await p.inputValue("#f-packageInterest")) === "Basic Gathering", "'Ask about this' pre-selects the option");
  await p.fill("#f-name", "Ana"); await p.fill("#f-phone", "9295550102"); await p.fill("#f-email", "ana@example.com");
  await p.selectOption("#f-eventType", "Birthday party"); await p.fill("#f-eventDate", inDays(60)); await p.fill("#f-guests", "30");
  await p.fill("#f-startTime", "18:00"); await p.fill("#f-endTime", "17:00");
  await p.getByRole("button", { name: "Send my event request" }).click();
  ok(/after the start/i.test(await p.locator("#f-endTime-err").textContent()), "end time before start time is caught");
  await p.fill("#f-endTime", "21:00");
  await p.getByRole("button", { name: "Send my event request" }).click();
  await p.locator(".thanks").waitFor();
  const a = await site.login();
  const ev = (await a.get("inquiries?type=event")).json.rows[0];
  ok(ev.fields.packageInterest === "Basic Gathering" && ev.fields.guests === "30" && ev.fields.endTime === "21:00", "event request saved with option, guests and times");
  await ctx.close();
}

/* ---------- admin dashboard in the browser ---------- */
{
  const { ctx, p } = await mk(390, 844);
  await p.goto(site.u + "/admin/", { waitUntil: "load" });
  await p.getByLabel("Password").fill("wrong-password-1");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.locator(".msg.bad").waitFor();
  ok(/Wrong username or password/.test(await p.locator(".msg.bad").textContent()), "wrong password is refused with a clear message");
  await p.getByLabel("Password").fill("owner-pass-12345");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.getByRole("button", { name: /Large orders|Event rentals|Sam Lee|Ana/ }).first().waitFor();
  ok(await noOverflow(p), "dashboard fits a phone screen");
  await p.screenshot({ path: `${OUT}/up-admin-m.png` });
  const wrap = p.locator(".card", { has: p.locator(".req", { hasText: "Sam Lee" }) });
  await wrap.locator(".req").click();
  ok(await p.getByText("12 Example St, Staten Island").isVisible(), "request details show every answer");
  ok(await p.locator('a[href="tel:9295550101"]').isVisible() || (await p.locator('a[href^="tel:"]').count()) > 0, "Call button for the customer");
  await wrap.locator("select").selectOption("quote_sent");
  await wrap.locator("textarea").fill("Quoted $600 by phone");
  await wrap.getByRole("button", { name: "Save", exact: true }).click();
  await wrap.getByText("Saved.").waitFor();
  const a = await site.login();
  const r = (await a.get("inquiries?q=Sam")).json.rows[0];
  ok(r.status === "quote_sent" && r.notes === "Quoted $600 by phone", "status and notes saved from the browser");

  // menu
  await p.getByRole("button", { name: "Menu", exact: true }).click();
  await p.getByLabel("Find a menu item").fill("Latte");
  const price = p.locator('.item:not([hidden]) [data-f=cents]').first();
  await price.waitFor();
  await price.fill("5.25");
  await p.getByRole("button", { name: "Save menu" }).click();
  await p.getByText(/Saved\. The website/).waitFor();
  const pub = await (await fetch(site.u + "/menu.json")).json();
  ok(Object.values(pub.groups).some((c) => Object.values(c).flat().some((i) => /latte/i.test(i.name) && i.cents === 525)), "menu price edit is live on /menu.json");
  await price.fill("abc");
  await p.getByRole("button", { name: "Save menu" }).click();
  ok(/needs a price/.test(await p.locator(".savebar .msg").textContent()), "a bad price is explained, nothing saved");
  await price.fill("5.25");

  // site info + review + photo
  await p.getByRole("button", { name: "Site info" }).click();
  await p.getByRole("button", { name: "+ Add a review" }).click();
  await p.getByLabel("Customer name (as they want it shown)").fill("Jordan P.");
  await p.getByLabel("What they wrote").fill("Great trays for our office party.");
  await p.getByLabel("Where it was posted (Google, Instagram, in person…)").fill("Google");
  await p.getByRole("button", { name: "Save changes" }).click();
  await p.getByText(/Saved\. The website/).first().waitFor();
  const pg = await ctx.newPage();
  await pg.goto(site.u + "/", { waitUntil: "load" });
  ok(await pg.getByText("Great trays for our office party.").count() === 1, "a real review entered in the dashboard appears on the site");
  const ld2 = await pg.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)));
  ok(ld2[0].review?.[0]?.author?.name === "Jordan P." && !ld2[0].aggregateRating, "review is in search data, still no invented rating");
  await pg.close();

  await p.getByRole("button", { name: "Photos" }).click();
  const png = "/tmp/claude-0/test-photo.png";
  fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await p.setInputFiles("#pick", png);
  await p.getByRole("button", { name: "Upload", exact: true }).click();
  await p.getByText("1 photo uploaded.").waitFor();
  await p.getByRole("button", { name: "Add to gallery" }).click();
  await p.getByRole("button", { name: "Save changes" }).click();
  const fl = p.locator(".msg.flash", { hasText: /description/i }).first();
  await fl.waitFor();
  ok(/description/i.test(await fl.textContent()), "gallery photo without a description is refused with a plain message");
  await p.getByLabel("Description (required)").fill("The front counter at Maruf Cafe");
  await p.getByRole("button", { name: "Save changes" }).click();
  await p.getByText(/Saved\. The website/).first().waitFor();
  const pg2 = await ctx.newPage();
  await pg2.goto(site.u + "/large-orders", { waitUntil: "load" });
  ok((await pg2.locator("#gallery img[alt='The front counter at Maruf Cafe']").count()) === 1, "gallery photo shows on the site with its description");
  await pg2.close();

  await p.getByRole("button", { name: "Setup" }).click();
  await p.getByText("Is everything switched on?").waitFor();
  ok(/Email alerts are on/.test(await p.locator(".check-ok").allTextContents().then((t) => t.join(" "))), "setup page shows email alerts are on");
  await p.screenshot({ path: `${OUT}/up-admin-setup-m.png` });
  await ctx.close();

  // staff
  const s = await mk(390, 844);
  await s.p.goto(site.u + "/admin/", { waitUntil: "load" });
  await s.p.getByLabel("Username").fill("staff"); await s.p.getByLabel("Password").fill("staff-pass-12345");
  await s.p.getByRole("button", { name: "Sign in" }).click();
  await s.p.getByRole("button", { name: /Sam Lee/ }).first().waitFor();
  const tabs = await s.p.$$eval(".tabs button", (b) => b.map((x) => x.textContent));
  ok(tabs.join() === "Requests,Menu", "staff see Requests and Menu only: " + tabs.join());
  await s.ctx.close();
}

/* ---------- desktop look ---------- */
{
  const { ctx, p } = await mk(1280, 800, false);
  for (const [path, name] of [["/", "home"], ["/large-orders", "large"], ["/rent-the-cafe", "rent"]]) {
    await p.goto(site.u + path, { waitUntil: "load" }); await p.waitForTimeout(700);
    ok(await noOverflow(p), `${path}: desktop has no sideways scroll`);
    ok(await p.locator(".mobile-bar").isHidden(), `${path}: quick-action bar hidden on desktop`);
  }
  await p.goto(site.u + "/large-orders", { waitUntil: "load" });
  await p.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in")));
  await p.screenshot({ path: `${OUT}/up-large-d.png`, fullPage: true });
  await ctx.close();
}

await b.close(); site.close();
console.log(fails.length ? `\n${fails.length} PROBLEM(S):\n` + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
