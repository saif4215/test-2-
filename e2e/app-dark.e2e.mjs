// Dark mode: the app follows the phone's light or dark setting, also when it changes while the app is open, and keeps the order.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-dark.e2e.mjs
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";

const site = await startSite({});
const b = await chromium.launch({ executablePath: "" + (process.env.CHROMIUM || "/opt/pw-browsers/chromium") + "" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const mk = async (colorScheme) => (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme })).newPage();
const hasBg = (p, rgb) => p.evaluate((c) => [...document.querySelectorAll("div")].some((d) => getComputedStyle(d).backgroundColor === c && d.getBoundingClientRect().height > 600), rgb);
const DARK = "rgb(20, 16, 12)", LIGHT = "rgb(251, 248, 242)";

const d = await mk("dark");
d.on("pageerror", (e) => fails.push("pageerror: " + e.message));
await d.goto(site.u + "/app/menu", { waitUntil: "load" });
await d.waitForTimeout(1500);
ok(await hasBg(d, DARK) && !(await hasBg(d, LIGHT)), "a phone in dark mode gets the dark app");
await d.screenshot({ path: `${SHOTS}/dark-menu.png` });

const l = await mk("light");
l.on("pageerror", (e) => fails.push("pageerror: " + e.message));
await l.goto(site.u + "/app/menu", { waitUntil: "load" });
await l.waitForTimeout(1500);
ok(await hasBg(l, LIGHT) && !(await hasBg(l, DARK)), "a phone in light mode gets the light app");

// the phone changes look while the app is open: the app follows, and the order is still there
await l.getByRole("button", { name: "Add Lemonade to order", exact: true }).first().click();
await l.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).first().waitFor();
await l.emulateMedia({ colorScheme: "dark" });
await l.waitForTimeout(1500);
ok(await hasBg(l, DARK), "switching the phone to dark while the app is open turns the app dark");
await l.goto(site.u + "/app/menu", { waitUntil: "load" });
await l.waitForTimeout(1500);
ok(await l.getByRole("button", { name: /^View my order \(1\)/ }).filter({ visible: true }).count() > 0, "and the order is still there");
await l.emulateMedia({ colorScheme: "light" });
await l.waitForTimeout(1500);
ok(await hasBg(l, LIGHT), "switching back turns it light again");

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
