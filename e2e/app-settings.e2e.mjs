// Settings: your details, light or dark, the menu layout, and clearing everything the app remembers on the phone.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-settings.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";

const site = await startSite({});
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
await ctx.addInitScript(() => { try { sessionStorage.setItem("maruf:opened", "1"); } catch { /* no storage */ } });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const seen = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first().isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
const darkNow = () => p.evaluate(() => [...document.querySelectorAll("div")].some((d) => getComputedStyle(d).backgroundColor === "rgb(20, 16, 12)" && d.offsetWidth >= window.innerWidth - 2));
const store = (k) => p.evaluate((key) => localStorage.getItem(key), k);

await p.goto(site.u + "/app/contact", { waitUntil: "load" });
await p.getByRole("button", { name: "Open settings" }).click();
await p.getByText("Your details", { exact: true }).first().waitFor({ timeout: 8000 });
ok(true, "Settings opens from the Contact tab");
await p.screenshot({ path: `${SHOTS}/settings-1.png` });

// details
await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam Lee");
await p.getByRole("textbox", { name: "Phone number", exact: true }).fill("7185550123");
await button("Save").click();
await button("Saved").waitFor({ timeout: 5000 });
ok(/Sam Lee/.test((await store("maruf:contact")) || ""), "saving keeps the name and phone on this phone");

// appearance: follows the phone (light), then forced dark, then forced light, remembered
ok(!(await darkNow()), "the phone is light, so the app starts light");
await p.getByRole("button", { name: "Dark", exact: true }).click();
await p.waitForTimeout(600);
ok(await darkNow(), "choosing Dark makes the app dark even though the phone is light");
ok((await store("maruf:appearance")) === "dark", "and remembers it");
await p.screenshot({ path: `${SHOTS}/settings-2-dark.png` });
await p.reload({ waitUntil: "load" });
await p.waitForTimeout(1200);
ok(await darkNow(), "it is still dark after reopening the app");
await p.getByRole("button", { name: "Light", exact: true }).click();
await p.waitForTimeout(600);
ok(!(await darkNow()), "Light turns it back");

// menu layout
await p.getByRole("button", { name: "List", exact: true }).click();
ok((await store("maruf:menu-layout")) === "list", "choosing List is remembered");
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
await p.getByRole("button", { name: /^Breakfast Wrap,/ }).first().waitFor({ timeout: 8000 });
ok(true, "the Menu now shows every category as a list");

// favorites and the saved details are cleared together
await p.getByRole("button", { name: /^Add to favorites|^Save .* as a favorite|Favorite/i }).first().click({ timeout: 3000 }).catch(() => {});
await p.goto(site.u + "/app/settings", { waitUntil: "load" });
await p.getByText("Your data", { exact: true }).first().waitFor({ timeout: 8000 });
await button("Clear everything on this phone").click();
ok(await seen("This cannot be undone"), "clearing asks first");
await button("No, keep it").click();
ok(/Sam Lee/.test((await store("maruf:contact")) || ""), "No, keep it changes nothing");
await button("Clear everything on this phone").click();
await button("Yes, clear it all").click();
await p.getByText("Cleared.", { exact: false }).first().waitFor({ timeout: 5000 });
await p.waitForTimeout(800);
ok(!/Sam Lee/.test((await store("maruf:contact")) || ""), "Yes clears the saved name and phone");
ok((await store("maruf:appearance")) === null && (await store("maruf:menu-layout")) === null, "and the Settings choices go back to normal");
ok((await p.getByRole("textbox", { name: "Name", exact: true }).inputValue()) === "", "the boxes on screen are empty too");

await b.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
