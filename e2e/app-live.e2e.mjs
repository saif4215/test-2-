import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
const site = await startSite();
const b = await chromium.launch({ executablePath: ""+(process.env.CHROMIUM||"/opt/pw-browsers/chromium")+"" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const a = await site.login();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const up = (await a.call("POST", "uploads", PNG, { "Content-Type": "image/png" })).json.upload;

// before: bundled content, quick actions present
await p.goto(site.u + "/app/", { waitUntil: "load" });
await p.getByText("Start an order").first().waitFor();
ok(await p.getByRole("button", { name: /Call Maruf Cafe at \(929\) 335-3296/ }).first().isVisible(), "Call quick action on Home");
ok(await p.getByRole("button", { name: "Large Orders" }).first().isVisible() && await p.getByRole("button", { name: "Rent the Cafe" }).first().isVisible(), "Large Orders and Rent the Cafe quick actions on Home");
ok((await p.getByText("What customers say").count()) === 0 && (await p.getByText("Photos").count()) === 0, "no reviews or gallery until the café adds real ones");

// the café edits things in the dashboard
const content = (await a.get("content")).json.content;
content.business.phone = "(718) 555-0100"; content.business.phoneTel = "+17185550100"; content.business.email = "hello@example.com";
content.reviews = [{ name: "Jordan P.", source: "Google", text: "Great trays for our office party." }];
content.gallery = [{ url: up.url, alt: "The front counter", caption: "" }];
content.venue.capacity = "Up to 40 seated";
content.packages[0].price = "Ask for pricing";
content.photos.hero = up.url;
ok((await a.put("content", { content })).status === 200, "content saved");
const menu = (await a.get("menu")).json.menu;
const latte = menu.groups.Drinks.Coffee.find((i) => i.id === "drinks-coffee-latte"); latte.cents = 575;
const esp = menu.groups.Drinks.Coffee.find((i) => i.id === "drinks-coffee-americano"); esp.hidden = true;
await a.put("menu", { menu });

await p.reload({ waitUntil: "load" });
await p.getByText("What customers say").first().waitFor({ timeout: 10000 });
ok(await p.getByText("Great trays for our office party.").first().isVisible(), "real review shows in the app");
ok(await p.getByText("Photos").first().isVisible(), "gallery shows in the app");
ok(await p.getByRole("button", { name: /Call Maruf Cafe at \(718\) 555-0100/ }).first().isVisible(), "new phone number in the app");
ok(await p.locator('img[src*="/uploads/"]').count() > 0, "uploaded photo is loaded from the café's server");
await p.getByRole("tab", { name: /Menu/ }).first().click();
await p.getByRole("button", { name: /^Coffee$|Coffee/ }).first().click().catch(() => {});
await p.waitForTimeout(500);
ok(await p.getByText("$5.75").first().isVisible().catch(() => false), "edited price shows on the menu");
ok((await p.getByLabel("Add Americano to order").count()) === 0, "a hidden item is not on the menu");
await p.getByRole("tab", { name: /Events/ }).first().click();
ok(await p.getByText("Up to 40 seated").first().isVisible(), "venue capacity entered by the café shows (and only then)");
ok(await p.getByText("Ask for pricing").first().isVisible(), "option price shows only because the café set it");
await p.getByRole("tab", { name: /Contact/ }).first().click();
ok(await p.getByText("hello@example.com").first().isVisible(), "email shows once the café adds it");
await p.screenshot({ path: (process.env.SHOTS_DIR || "/tmp") + "/up-app-contact.png" });
await p.getByRole("tab", { name: /Home/ }).first().click();
await p.waitForTimeout(500);
await p.screenshot({ path: (process.env.SHOTS_DIR || "/tmp") + "/up-app-home.png" });
await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
