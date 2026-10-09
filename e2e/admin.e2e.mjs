import fs from "node:fs";
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";

const OUT = process.env.SHOTS_DIR || "/tmp";
const site = await startSite({ PUBLIC_URL: "" });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const mk = async (w = 390, h = 844, mobile = true) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) fails.push("console: " + m.text()); });
  return { ctx, p };
};
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const a0 = await site.login();
const { goodOrder, goodEvent } = await import("../test-helpers.mjs");
await site.post({ type: "large-order", fields: { ...goodOrder(), fulfillment: "delivery", deliveryAddress: "12 Example St, Staten Island", dietary: "One guest has a nut allergy" } });
await site.post({ type: "event", fields: goodEvent() });
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
  await p.getByText(/Saved\. The app shows it now/).waitFor();
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
  await p.getByText(/Saved\. The app shows it now/).first().waitFor();
  const live = await (await fetch(site.u + "/content.json")).json();
  ok(live.reviews.length === 1 && live.reviews[0].name === "Jordan P.", "a real review entered in the dashboard is served to the app");

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
  await p.getByText(/Saved\. The app shows it now/).first().waitFor();
  const live2 = await (await fetch(site.u + "/content.json")).json();
  ok(live2.gallery.length === 1 && live2.gallery[0].alt === "The front counter at Maruf Cafe", "gallery photo is served with its description");

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

await b.close(); site.close();
console.log(fails.length ? `\n${fails.length} PROBLEM(S):\n` + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
