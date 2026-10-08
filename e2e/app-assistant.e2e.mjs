import http from "node:http";
import { chromium } from "playwright-core";
import { startSite } from "../test-helpers.mjs";
const OUT = process.env.SHOTS_DIR || "/tmp";
const fails = [], ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails.push(m); };
const calls = []; let mode = "ok";
const claude = http.createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  calls.push(JSON.parse(raw)); res.setHeader("content-type", "application/json");
  if (mode === "down") { res.statusCode = 529; return res.end("{}"); }
  const last = calls.at(-1).messages.at(-1).content;
  res.end(JSON.stringify({ content: [{ type: "text", text: /30 people/.test(last) ? "For 30 people, a good starting point is about one meal each, so around 30. Maruf Cafe will confirm trays and prices when you send a request." : "A Latte is $4.50." }] }));
});
await new Promise((r) => claude.listen(0, r));
const b = await chromium.launch({ executablePath: ""+(process.env.CHROMIUM||"/opt/pw-browsers/chromium")+"" });
const mk = async () => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.on("pageerror", (e) => fails.push("pageerror: " + e.message)); return p; };

// ---- off
{
  const site = await startSite(); const p = await mk();
  await p.goto(site.u + "/app/", { waitUntil: "load" });
  await p.getByRole("button", { name: "Start an order" }).waitFor();
  ok(await p.getByRole("button", { name: "Start an order" }).isVisible(), "big 'Start an order' on Home");
  ok(await p.getByRole("button", { name: /^Catering:/ }).isVisible() && await p.getByRole("button", { name: /^Rent the spot:/ }).isVisible(), "smaller Catering and Rent the spot buttons");
  const big = await p.getByRole("button", { name: "Start an order" }).boundingBox(), small = await p.getByRole("button", { name: /^Catering:/ }).boundingBox();
  ok(big.height > small.height * 1.4 && big.width > small.width * 1.7, "start-an-order is clearly the big one");
  await p.screenshot({ path: `${OUT}/ai-1-home.png` });
  await p.getByRole("button", { name: "Ask a question (AI helper)" }).click();
  await p.getByText("isn't switched on yet").waitFor();
  ok(await p.getByRole("button", { name: /Call \(929\) 335-3296/ }).isVisible(), "when off it says so and offers the phone");
  ok((await p.getByRole("textbox", { name: "Your question" }).count()) === 0, "no fake chat box when off");
  await p.screenshot({ path: `${OUT}/ai-2-off.png` });
  await p.close(); site.close();
}
// ---- on
{
  const site = await startSite({ ANTHROPIC_API_KEY: "sk-test", ANTHROPIC_API_BASE: `http://localhost:${claude.address().port}` }); const p = await mk();
  await p.goto(site.u + "/app/", { waitUntil: "load" });
  await p.getByRole("button", { name: "Start an order" }).waitFor();
  await p.getByRole("button", { name: "Ask a question (AI helper)" }).click();
  await p.getByText("How can I help?").waitFor();
  await p.screenshot({ path: `${OUT}/ai-3-chat.png` });
  await p.getByRole("button", { name: "Help me plan food for 30 people" }).click();
  await p.getByText(/around 30/).waitFor();
  ok(true, "starter question gets an answer");
  ok(await p.getByRole("button", { name: "Start a large order request" }).isVisible(), "answer offers the request form");
  ok(calls[0].messages.length === 1 && calls[0].messages[0].role === "user", "only the question was sent to the server");
  await p.getByRole("textbox", { name: "Your question" }).fill("How much is a latte?");
  await p.getByRole("button", { name: "Send question" }).click();
  await p.getByText("A Latte is $4.50.").waitFor();
  ok(calls[1].messages.length === 3, "follow-up carries the conversation");
  mode = "down";
  await p.getByRole("textbox", { name: "Your question" }).fill("Anything else?");
  await p.getByRole("button", { name: "Send question" }).click();
  await p.getByText("The assistant is busy right now. Please try again, or call us.").waitFor();
  ok(true, "if the AI is down the chat says so plainly");
  await p.screenshot({ path: `${OUT}/ai-4-chat.png` });
  await p.getByRole("button", { name: "Start a large order request" }).count().then((n) => ok(n === 0, "no cheerful 'next step' buttons under an error"));
  await p.close(); site.close();
}
await b.close(); claude.close();
console.log(fails.length ? "\nPROBLEMS:\n" + fails.join("\n") : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
