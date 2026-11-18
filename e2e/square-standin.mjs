// A stand-in for Square's Orders API, for the browser tests: it remembers the orders it is given and answers for them,
// with a fulfillment state the test can change (PROPOSED, RESERVED, PREPARED, COMPLETED, CANCELED).
import http from "node:http";

export async function startSquare() {
  const calls = [], orders = new Map();
  const state = { fulfillment: "PROPOSED", loyalty: true };   // loyalty: false = this Square account has no Loyalty add-on
  const accounts = new Map(), counted = new Map();   // loyalty accounts by id; points already given for an order, by account+order
  const PROGRAM = { id: "PROGRAM1", status: "ACTIVE", reward_tiers: [{ id: "TIER_COOKIE", name: "A free cookie", points: 10 }, { id: "TIER_DRINK", name: "A free drink", points: 100 }] };
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const json = raw ? JSON.parse(raw) : {};
    calls.push({ method: req.method, url: req.url, json });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/v2/orders") {
      const sub = json.order.line_items.reduce((s, l) => s + l.base_price_money.amount * Number(l.quantity), 0);
      const order = { id: "SQORDER" + (orders.size + 1) + "ABCDEF", state: "OPEN", location_id: json.order.location_id, reference_id: json.order.reference_id, source: json.order.source, total_money: { amount: Math.round(sub * 1.08875), currency: "USD" }, total_tax_money: { amount: Math.round(sub * 1.08875) - sub, currency: "USD" }, fulfillments: [{ type: "PICKUP", state: "PROPOSED", pickup_details: json.order.fulfillments?.[0]?.pickup_details }] };
      orders.set(order.id, order);
      return res.end(JSON.stringify({ order }));
    }
    if (req.method === "POST" && req.url === "/v2/gift-cards/from-gan") {
      calls.giftcards = (calls.giftcards || 0) + 1;
      const cards = { "7783320001234567": { id: "gftc:1", gan: "7783320001234567", state: "ACTIVE", balance_money: { amount: 2550, currency: "USD" } }, "7783320009999999": { id: "gftc:2", gan: "7783320009999999", state: "DEACTIVATED", balance_money: { amount: 700, currency: "USD" } } };
      const c = cards[json.gan];
      if (!c) { res.statusCode = 404; return res.end(JSON.stringify({ errors: [{ code: "NOT_FOUND", detail: "Gift card not found" }] })); }
      return res.end(JSON.stringify({ gift_card: c }));
    }
    if (req.url.startsWith("/v2/loyalty/")) {
      calls.loyalty = (calls.loyalty || 0) + 1;
      if (!state.loyalty) { res.statusCode = 404; return res.end(JSON.stringify({ errors: [{ code: "NOT_FOUND", detail: "no loyalty program" }] })); }
      if (req.method === "GET" && req.url === "/v2/loyalty/programs/main") return res.end(JSON.stringify({ program: PROGRAM }));
      if (req.method === "POST" && req.url === "/v2/loyalty/accounts/search") { const ph = json.query?.mappings?.[0]?.phone_number; return res.end(JSON.stringify({ loyalty_accounts: [...accounts.values()].filter((a) => a.mapping.phone_number === ph) })); }
      if (req.method === "POST" && req.url === "/v2/loyalty/accounts") { const a = { id: "LACC" + (accounts.size + 1), program_id: json.loyalty_account.program_id, balance: 0, lifetime_points: 0, mapping: json.loyalty_account.mapping }; accounts.set(a.id, a); return res.end(JSON.stringify({ loyalty_account: a })); }
      const acc = /^\/v2\/loyalty\/accounts\/(\w+)(\/accumulate)?$/.exec(req.url);
      if (acc && accounts.has(acc[1])) {
        const a = accounts.get(acc[1]);
        if (req.method === "GET" && !acc[2]) return res.end(JSON.stringify({ loyalty_account: a }));
        if (req.method === "POST" && acc[2]) {
          const o = orders.get(json.accumulate_points?.order_id);
          if (!o || o.fulfillments[0].state !== "COMPLETED") { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ code: "BAD_REQUEST", detail: "The order has not been paid." }] })); }
          const k = a.id + o.id;
          if (!counted.has(k)) { const pts = Math.floor((o.total_money.amount - o.total_tax_money.amount) / 100); counted.set(k, pts); a.balance += pts; a.lifetime_points += pts; }
          return res.end(JSON.stringify({ events: [{ type: "ACCUMULATE_POINTS", accumulate_points: { order_id: o.id, points: counted.get(k) } }] }));
        }
      }
      res.statusCode = 404; return res.end(JSON.stringify({ errors: [{ code: "NOT_FOUND" }] }));
    }
    const got = /^\/v2\/orders\/(\w+)$/.exec(req.url);
    if (req.method === "GET" && got && orders.has(got[1])) { const o = orders.get(got[1]); o.fulfillments[0].state = state.fulfillment; return res.end(JSON.stringify({ order: o })); }
    res.statusCode = 404; res.end(JSON.stringify({ errors: [{ code: "NOT_FOUND" }] }));
  });
  await new Promise((r) => server.listen(0, r));
  server.unref();
  return { url: `http://localhost:${server.address().port}`, calls, orders, accounts, set: (f) => { state.fulfillment = f; }, loyalty: (on) => { state.loyalty = on; } };
}
