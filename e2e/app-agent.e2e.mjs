// The AI agent in a real browser: the customer's order helper (it proposes, the customer confirms), the staff assistant in the dashboard,
// and nothing of it showing when no AI is connected. The AI is a stand-in server that answers with fixed JSON.
// Needs a built app (npm run build) and Chromium. Run:  node e2e/app-agent.e2e.mjs
import http from "node:http";
import { chromium } from "playwright-core";
import { startSite, goodOrder } from "../test-helpers.mjs";

const aiCalls = [];
const ai = http.createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  const body = JSON.parse(raw); aiCalls.push(body);
  const last = String(body.messages.at(-1).content);
  let text = "We open at 7 AM.";
  if (/lattes and a bagel/i.test(last)) text = '```json\n' + JSON.stringify({ reply: "Two iced lattes and a bagel. Please check them below.", add: [{ id: "drinks-coffee-latte", qty: 2, note: "Iced" }, { id: "food-breakfast-bagel-and-cream-cheese", qty: 1 }, { id: "not-on-the-menu", qty: 5 }] }) + '\n```';
  else if (/mystery/i.test(last)) text = JSON.stringify({ reply: "I'm not sure about that one. Please call (929) 335-3296.", handoff: true, add: [] });
  else if (/^REQUEST/.test(last)) text = JSON.stringify({ summary: "Sam wants food for 40 people.", check: ["Is the date free?"], reply: "Hi Sam, thanks for asking. [STAFF: confirm the date] Maruf Cafe" });
  else if (/^OPEN REQUESTS/.test(last)) text = JSON.stringify({ overview: "One request is waiting.", attention: [{ n: 1, why: "no reply yet" }] });
  res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ content: [{ type: "text", text }] }));
});
await new Promise((r) => ai.listen(0, r)); ai.unref();

const site = await startSite({ ANTHROPIC_API_KEY: "k", ANTHROPIC_API_BASE: `http://localhost:${ai.address().port}`, ASSISTANT_RATE_LIMIT_PER_MIN: "100" });
const b = await chromium.launch({ executablePath: "" + (process.env.CHROMIUM || "/opt/pw-browsers/chromium") + "" });
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => fails.push("pageerror: " + e.message));
const shown = (text) => p.getByText(text, { exact: false }).filter({ visible: true }).first();
const seen = (text) => shown(text).isVisible().catch(() => false);
const button = (name) => p.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

// ── the customer's order helper ─────────────────────────────────────────────────────────────────────────────────────────────────
await p.goto(site.u + "/app/menu", { waitUntil: "load" });
const nudge = p.getByRole("button", { name: /^Tell the assistant what you want/ }).first();
await nudge.waitFor({ timeout: 8000 });
ok(true, "with an AI connected, the Menu offers to put an order together");
await nudge.click();
await p.getByText("Nothing is ordered until you place it yourself", { exact: false }).first().waitFor();
await button("2 iced lattes and a bagel").click();
await p.getByText("Check before adding", { exact: false }).first().waitFor({ timeout: 10000 });
ok(await seen("2 × Latte") && await seen("1 × Bagel & Cream Cheese") && await seen("Request: Iced"), "what the AI understood is shown as items, quantities and requests");
ok(!(await seen("not-on-the-menu")) && !(await seen("5 × ")), "an item that is not on the menu never shows");
ok(await seen("$12.00") && await seen("Subtotal"), "a subtotal is shown, worked out from the menu's prices");
ok(await seen("Nothing is ordered yet"), "it says nothing is ordered yet");
ok((await p.getByRole("button", { name: /^View my order \(/ }).filter({ visible: true }).count()) === 0, "nothing was put in the order before the customer confirmed");
await p.screenshot({ path: `${SHOTS}/agent-1-proposal.png` });
await button("Add to my order").click();
await shown("Added to your order").waitFor();
await button("View my order").click();
await p.getByRole("button", { name: "Latte: change options or add a note" }).first().waitFor();
ok(await seen("Small; Iced"), "the order has the Latte, its size, and the request the customer confirmed");
ok(await seen("3 items"), "and the right number of items");
const sys = aiCalls[0].system;
ok(sys.includes("drinks-coffee-latte = Latte Small $4.50 / Large $5.50") && /You never place an order/.test(sys), "the AI was given the real menu and told it cannot order");
ok(!JSON.stringify(aiCalls).includes("7185550") , "no contact details went to the AI");

// a plain question gets just an answer
await p.goBack();
await p.waitForTimeout(500);
await p.getByRole("textbox", { name: "Your question" }).fill("When do you open?");
await button("Send question").click();
await p.getByText("We open at 7 AM.", { exact: false }).first().waitFor({ timeout: 8000 });
ok(!(await seen("Check before adding")) || (await p.getByText("Check before adding").filter({ visible: true }).count()) === 1, "a plain question does not add a second order card");

// when the AI says a person should answer, the chat shows a Call button
await p.getByRole("textbox", { name: "Your question" }).fill("Is the mystery special spicy?");
await button("Send question").click();
await p.getByText("I'm not sure about that one", { exact: false }).first().waitFor({ timeout: 8000 });
ok((await p.getByRole("button", { name: "Call Maruf Cafe at (929) 335-3296" }).filter({ visible: true }).count()) >= 1 && await seen("Call (929) 335-3296"), "when the answer is 'ask a person', the chat shows a Call button");
await p.screenshot({ path: `${SHOTS}/agent-3-call.png` });

// ── the staff assistant ─────────────────────────────────────────────────────────────────────────────────────────────────────────
await site.post({ type: "large-order", fields: { ...goodOrder(), fullName: "Sam Lee" }, website: "" });
const d = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const q = await d.newPage();
q.on("pageerror", (e) => fails.push("pageerror: " + e.message));
await q.goto(site.u + "/admin/", { waitUntil: "load" });
await q.getByLabel("Password").fill("owner-pass-12345");
await q.getByRole("button", { name: "Sign in" }).click();
await q.getByRole("button", { name: "Summarize what is open" }).waitFor({ timeout: 8000 });
await q.getByRole("button", { name: "Summarize what is open" }).click();
await q.getByText("One request is waiting.").waitFor({ timeout: 8000 });
ok(await q.getByText("no reply yet").isVisible() && await q.getByText("Sam (Large order quote request)", { exact: false }).isVisible(), "the overview says what is open and why a request stands out");
await q.locator(".req", { hasText: "Sam Lee" }).click();
await q.getByRole("button", { name: "Summarize and draft a reply" }).click();
await q.getByLabel("Draft reply").waitFor({ timeout: 8000 });
ok((await q.getByLabel("Draft reply").inputValue()).includes("[STAFF: confirm the date]"), "a draft reply appears with a note where staff must decide");
ok(await q.getByText("Is the date free?").isVisible() && await q.getByText("Sam wants food for 40 people.").isVisible(), "with a summary and what to check first");
ok(await q.getByText("Nothing was sent, and the status did not change.", { exact: false }).isVisible(), "it says plainly that nothing was sent");
await q.getByLabel("Draft reply").fill("Hi Sam, edited by a person.");
ok((await q.getByLabel("Draft reply").inputValue()) === "Hi Sam, edited by a person.", "staff can edit the draft");
const askUser = aiCalls.filter((c) => /^REQUEST/.test(String(c.messages.at(-1).content))).map((c) => c.messages.at(-1).content).join("\n");
ok(askUser.includes("name: Sam") && !/Lee|sam@example|555-0101/.test(askUser), "the AI got the first name and the details, not the phone or email");
await q.screenshot({ path: `${SHOTS}/agent-2-staff.png` });
await d.close();

// ── built-in chat: a question it cannot answer also offers the phone ─────────────────────────────────────────────────────────────
{
  const plain = await startSite({});
  const p3 = await ctx.newPage();
  await p3.goto(plain.u + "/app/assistant", { waitUntil: "load" });
  await p3.getByRole("textbox", { name: "Your question" }).fill("tell me a joke");
  await p3.getByRole("button", { name: "Send question", exact: true }).click();
  await p3.getByText("I'm not sure about that one", { exact: false }).first().waitFor({ timeout: 8000 });
  ok((await p3.getByRole("button", { name: "Call Maruf Cafe at (929) 335-3296" }).filter({ visible: true }).count()) >= 1, "the built-in chat offers the phone when it does not know");
  await p3.goto(plain.u + "/app/assistant", { waitUntil: "load" });
  await p3.getByRole("textbox", { name: "Your question" }).fill("what are your hours");
  await p3.getByRole("button", { name: "Send question", exact: true }).click();
  await p3.getByText("We're open now", { exact: false }).or(p3.getByText("We're closed", { exact: false })).first().waitFor({ timeout: 8000 });
  ok((await p3.locator('[aria-label="Call Maruf Cafe at (929) 335-3296"]:visible').count()) === 1, "and when it does know, only the small Call link at the bottom remains");
  plain.close();
}

// ── without an AI nothing about the agent shows ──────────────────────────────────────────────────────────────────────────────────
const off = await startSite({});
const p2 = await ctx.newPage();
await p2.goto(off.u + "/app/menu", { waitUntil: "load" });
await p2.getByRole("button", { name: "Add Latte to order", exact: true }).first().waitFor();
await p2.waitForTimeout(1200);
ok((await p2.getByRole("button", { name: /^Tell the assistant what you want/ }).count()) === 0, "with no AI, the Menu does not offer the order helper");
await p2.goto(off.u + "/app/assistant", { waitUntil: "load" });
await p2.getByText("Answers come straight from the café's menu", { exact: false }).first().waitFor();
ok((await p2.getByRole("button", { name: "2 iced lattes and a bagel" }).count()) === 0, "and the chat offers only its plain starters");
const d2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const q2 = await d2.newPage();
await q2.goto(off.u + "/admin/", { waitUntil: "load" });
await q2.getByLabel("Password").fill("owner-pass-12345");
await q2.getByRole("button", { name: "Sign in" }).click();
await q2.getByRole("button", { name: /Large orders|Event rentals|Menu/ }).first().waitFor();
ok((await q2.getByRole("button", { name: "Summarize what is open" }).count()) === 0, "with no AI, the dashboard has no assistant buttons");
off.close();

await b.close(); site.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
