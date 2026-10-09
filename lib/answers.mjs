// The app's chat when no AI service is connected. It needs no key and costs nothing: it only repeats the café's own
// details (hours, address, phone, menu prices, event options, FAQ) and sends everything else to the request forms or
// a phone call. It never guesses, never confirms a date, a booking or a price, and never gives allergy advice.
import { fmtHour } from "./render.mjs";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const money = (c) => `$${(c / 100).toFixed(2)}`;
const priceOf = (i) => (i.cents != null ? money(i.cents) : `${money(i.min)}–${money(i.max)}, depending on size`);
const STOP = new Set("a an and are as at be by can do does for from get got has have how i if in is it its me my of on or our so than that the their there they this to us we what whats when where which who will with you your please tell about any some".split(" "));
const GENERIC = new Set(["iced", "hot", "cold", "small", "large", "medium", "extra", "with", "and", "the"]);

const words = (s) => String(s).toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").split(/[^a-z0-9]+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

/** The current day and hour in New York, which is when the café's hours apply. */
function newYork(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday), hour: Number(parts.hour) + Number(parts.minute) / 60 };
}

function hoursReply(b, now) {
  if (!b.hours.length) return `I don't have our hours here yet. Please call ${b.phone || "the café"}.`;
  const lines = b.hours.map((h) => `${h.label}: ${fmtHour(h.open)} to ${fmtHour(h.close)}`).join(". ");
  const ny = newYork(now), today = b.hours.find((h) => h.days.includes(ny.day));
  const status = today ? (ny.hour >= today.open && ny.hour < today.close ? ` We're open now, until ${fmtHour(today.close)}.` : ` We're closed right now.`) : ` We're closed today (${DAY_NAMES[ny.day]}).`;
  return `${lines}. (New York time.)${status}`;
}

/** The menu as flat rows: { group, cat, item }. */
function flatten(menu) {
  const rows = [];
  for (const [group, cats] of Object.entries(menu.groups || {})) for (const [cat, list] of Object.entries(cats)) for (const item of list) rows.push({ group, cat, item });
  return rows;
}

const CATEGORY_WORDS = [
  [/\b(breakfast|brunch|morning)\b/, "Breakfast"], [/\b(sandwich(es)?|sub|wrap)\b/, "Sandwiches"], [/\bburger/, "Burgers"], [/\b(wings?|chicken|tenders?)\b/, "Chicken & Wings"],
  [/\bbowls?\b/, "Bowls"], [/\bsalads?\b/, "Salads / Others"], [/\b(sides?|fries)\b/, "Sides"], [/\b(sweets?|desserts?|cakes?|cookies?|pastr(y|ies)|donuts?)\b/, "Sweets"],
  [/\bsmoothies?\b/, "Smoothies / Others"], [/\brefreshers?\b/, "Refreshers"], [/\b(tea|teas|chai|matcha)\b/, "Tea"], [/\b(coffee|espresso|cappuccino|cold brew)\b/, "Coffee"],
];

function listReply(title, rows, more) {
  const shown = rows.slice(0, 8).map((r) => `${r.item.name} ${priceOf(r.item)}`).join("; ");
  return `${title}: ${shown}.${rows.length > 8 ? ` Plus ${rows.length - 8} more in the Menu tab.` : ""}${more ? ` ${more}` : ""}`;
}

function findItems(text, rows) {
  const msg = new Set(words(text).filter((w) => !STOP.has(w)));
  const exact = [], partial = [];
  for (const r of rows) {
    const toks = words(r.item.name).filter((w) => !STOP.has(w));
    if (!toks.length) continue;
    const hit = toks.filter((t) => msg.has(t));
    if (hit.length === toks.length) exact.push({ r, n: toks.length });
    else if (hit.some((t) => !GENERIC.has(t)) && hit.length / toks.length >= 0.5) partial.push({ r, n: hit.length });
  }
  exact.sort((a, b) => b.n - a.n);
  return { exact: exact.slice(0, 5).map((e) => e.r), partial: partial.slice(0, 5).map((e) => e.r) };
}

function faqMatch(text, faq) {
  const msg = new Set(words(text).filter((w) => !STOP.has(w)));
  let best = null, bestScore = 0;
  for (const f of faq) {
    const q = words(f.q).filter((w) => !STOP.has(w));
    const score = q.filter((w) => msg.has(w)).length;
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return bestScore >= 2 || (best && bestScore >= 1 && words(best.q).filter((w) => !STOP.has(w)).length <= 2) ? best : null;
}

/** Answer the customer's last message from the café's details. Always returns { reply }. */
export function basicAnswer(content, menu, messages, now = new Date()) {
  const b = content.business, v = content.venue, text = String(messages.at(-1)?.content || "").trim(), t = text.toLowerCase();
  const call = b.phone ? `call ${b.phone}` : "call the café";
  const rows = flatten(menu);
  const reply = (r) => ({ reply: r });

  if (/\b(allerg\w*|gluten|celiac|vegan|vegetarian|halal|kosher|lactose|dairy|peanuts?|nuts?|ingredients?|sesame|shellfish)\b/.test(t))
    return reply(`I can't confirm ingredients or allergy information here. Please tell Maruf Cafe about any allergy in your request, or ${call}, before you order.`);
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(t) && words(t).length <= 4)
    return reply("Hi! I can answer questions about our menu and prices, hours, large orders and catering, and renting the café. What would you like to know?");
  if (/^(thanks|thank you|thx|ty|ok(ay)?|great|cool|awesome)\b/.test(t) && words(t).length <= 4) return reply("You're welcome! Ask anything else about the menu, hours, large orders or renting the café.");

  // renting the café
  if (/\b(rent\w*|venue|private (event|party|dinner)|hosting|host an?|reserv\w*|book\w*|capacity|how many (people|guests) (can|fit|does)|seat\w*|deposit|cancel\w*|polic\w*|rules?)\b/.test(t) || (/\b(event|party|birthday|baby shower|wedding|engagement)\b/.test(t) && /\b(space|room|place|rent|here|at the caf)\b/.test(t))) {
    const opts = content.packages.map((p) => p.title).join(", ");
    const bits = [];
    if (/capacity|how many|seat|fit/.test(t)) bits.push(v.capacity ? `The space holds ${v.capacity}.` : "I don't have the seating capacity yet. Maruf Cafe will confirm it when you send a request.");
    else if (/deposit|cancel|polic|rule/.test(t)) bits.push(v.policies ? v.policies : "Deposit, cancellation and other rules aren't listed yet. Maruf Cafe will go over them with you after your request.");
    else bits.push("Maruf Cafe may be available for private events." + (opts ? ` Options: ${opts}.` : "") + (v.notes ? ` ${v.notes}` : ""));
    bits.push("To ask about a date, open Events and tap Check a date. Nothing is booked until Maruf Cafe confirms it with you, and there's no payment in the app.");
    return reply(bits.join(" "));
  }

  // large orders and catering
  if (/\b(cater\w*|large orders?|big orders?|bulk|trays?|office|meeting|corporate|how much food|plan (the )?food|feed|group|\d+ (people|guests|persons))\b/.test(t))
    return reply("For big orders and catering, open Orders and tap Get a large order quote. Send your date, how many people, pickup or delivery, what you'd like and any allergies, and Maruf Cafe will get back to you with a quote. The Orders screen also has a group planner to help you estimate how much food to get. No payment is taken in the app.");

  if (/\b(hours?|open|opens|opening|close|closes|closing|closed|what time|until when|how late)\b/.test(t)) return reply(hoursReply(b, now));
  if (/\b(address|located|location|where are you|where is|directions?|find you|how do i get|parking|park)\b/.test(t))
    return reply(`${b.address.length ? `We're at ${b.address.join(", ")}.` : "I don't have our address here yet."} Tap the map on the Contact screen for directions in Google Maps, Apple Maps or Waze.${/park/.test(t) ? " I don't have parking details, so please ask when you call." : ""}`);
  if (/\b(phone|call|number|contact|email|reach|talk to|speak)\b/.test(t))
    return reply(`${b.phone ? `You can call us at ${b.phone}.` : "I don't have a phone number here yet."}${b.email ? ` Email: ${b.email}.` : ""} You can also send a request from Orders or Events and Maruf Cafe will get back to you.`);
  if (/\bdeliver\w*/.test(t)) {
    const f = content.faq.find((x) => /deliver/i.test(`${x.q} ${x.a}`));
    return reply(f ? f.a : `Maruf Cafe will confirm whether delivery is possible for your order. Send a request from Orders, or ${call}.`);
  }
  if (/\b(pay|payment|credit|debit|cash|tip)\b/.test(t))
    return reply("The app doesn't take payment or book anything. After you send a request, Maruf Cafe talks through the details and prices with you. For paying in the café, please call or ask when you visit.");

  // menu: a specific item, then a whole section, then picks
  const { exact, partial } = findItems(text, rows);
  const itemReply = (items) => reply(items.length === 1 ? `${items[0].item.name}: ${priceOf(items[0].item)} (before tax).` : listReply("Here's what I found", items, "Prices are before tax."));
  if (exact.length) return itemReply(exact);
  for (const [re, cat] of CATEGORY_WORDS) if (re.test(t)) {
    const inCat = rows.filter((r) => r.cat === cat);
    if (inCat.length) return reply(listReply(`Our ${cat.toLowerCase()}`, inCat, "Open the Menu tab to see everything and add items to your order."));
  }
  if (partial.length) return itemReply(partial);
  if (/\b(drinks?|beverages?)\b/.test(t)) return reply(`We have ${[...new Set(rows.filter((r) => r.group === "Drinks").map((r) => r.cat))].join(", ").toLowerCase().replace(/ \/ /g, " and ")}. Ask about any one of them, or open the Menu tab.`);
  if (/\b(menu|food|eat|hungry|lunch|dinner|what do you (have|serve|sell))\b/.test(t)) return reply(`Our food has ${[...new Set(rows.filter((r) => r.group === "Food").map((r) => r.cat))].join(", ").toLowerCase().replace(/ \/ /g, " and ")}, and we have drinks too. Ask about any of them, or open the Menu tab.`);
  if (/\b(recommend\w*|suggest\w*|popular|best|favou?rites?|try|good)\b/.test(t)) {
    const picks = rows.filter((r) => r.item.featured);
    if (picks.length) return reply(listReply("Our picks right now", picks, "They're also on the Home screen under Try these."));
  }

  const faq = faqMatch(text, content.faq);
  if (faq) return reply(faq.a);
  return reply(`I'm not sure about that one, and I don't want to guess. Maruf Cafe can tell you: ${call}, or send a request from Orders or Events. I can answer questions about the menu and prices, our hours and address, large orders and renting the café.`);
}
