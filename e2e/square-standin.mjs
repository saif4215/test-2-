// A stand-in for Square's Orders API, for the browser tests: it remembers the orders it is given and answers for them,
// with a fulfillment state the test can change (PROPOSED, RESERVED, PREPARED, COMPLETED, CANCELED).
import http from "node:http";

export async function startSquare() {
  const calls = [], orders = new Map();
  const state = { fulfillment: "PROPOSED", loyalty: true };   // loyalty: false = this Square account has no Loyalty add-on
  const orderKeys = new Map();   // order ids by idempotency key
  const payments = new Map();   // payments by idempotency key (Square answers a repeat of the same request with the same payment)
  const accounts = new Map(), counted = new Map();   // loyalty accounts by id; points already given for an order, by account+order
  const PROGRAM = { id: "PROGRAM1", status: "ACTIVE", reward_tiers: [{ id: "TIER_COOKIE", name: "A free cookie", points: 10 }, { id: "TIER_DRINK", name: "A free drink", points: 100 }] };
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const json = raw ? JSON.parse(raw) : {};
    calls.push({ method: req.method, url: req.url, json });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/v2/orders") {
      if (json.idempotency_key && orderKeys.has(json.idempotency_key)) return res.end(JSON.stringify({ order: orders.get(orderKeys.get(json.idempotency_key)) }));   // Square answers a repeat of the same request with the same order
      const sub = json.order.line_items.reduce((s, l) => s + l.base_price_money.amount * Number(l.quantity), 0);
      const order = { id: "SQORDER" + (orders.size + 1) + "ABCDEF", version: 1, state: "OPEN", location_id: json.order.location_id, reference_id: json.order.reference_id, source: json.order.source, total_money: { amount: Math.round(sub * 1.08875), currency: "USD" }, total_tax_money: { amount: Math.round(sub * 1.08875) - sub, currency: "USD" }, fulfillments: [{ type: "PICKUP", state: "PROPOSED", pickup_details: json.order.fulfillments?.[0]?.pickup_details }] };
      orders.set(order.id, order);
      if (json.idempotency_key) orderKeys.set(json.idempotency_key, order.id);
      return res.end(JSON.stringify({ order }));
    }
    if (req.method === "POST" && req.url === "/v2/payments") {
      calls.payments = (calls.payments || 0) + 1;
      const k = json.idempotency_key;
      const token = String(json.source_id || "");
      if (token === "cnon:card-nonce-network") return res.destroy();   // no answer at all: the charge may or may not have happened
      const prior = payments.get(k);
      if (prior) {
        if (prior.source_id !== token) { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "IDEMPOTENCY_KEY_REUSED", detail: "The idempotency key was already used with a different request." }] })); }
        return res.end(JSON.stringify({ payment: prior.payment }));
      }
      const order = orders.get(json.order_id);
      const bad = { "cnon:card-nonce-declined": "GENERIC_DECLINE", "cnon:card-nonce-cvv": "CVV_FAILURE", "cnon:card-nonce-funds": "INSUFFICIENT_FUNDS" }[token];
      if (bad) { res.statusCode = 402; return res.end(JSON.stringify({ errors: [{ category: "PAYMENT_METHOD_ERROR", code: bad, detail: "Declined by the stand-in" }] })); }
      if (!token.startsWith("cnon:card-nonce-ok") && !token.startsWith("wallet:")) { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "INVALID_CARD_DATA", detail: "bad token" }] })); }
      if (!order || order.state === "CANCELED" || json.amount_money.amount !== order.total_money.amount) { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ category: "INVALID_REQUEST_ERROR", code: "VALUE_TOO_LOW", detail: "amount does not match the order" }] })); }
      const payment = { id: "PAY" + (payments.size + 1), status: "COMPLETED", order_id: order.id, amount_money: json.amount_money, tip_money: json.tip_money, total_money: { amount: json.amount_money.amount + (json.tip_money ? json.tip_money.amount : 0), currency: "USD" }, location_id: json.location_id, reference_id: json.reference_id };
      payments.set(k, { source_id: token, payment, request: json });
      order.tenders = [{ id: "T" + payments.size, type: "CARD" }]; order.net_amount_due_money = { amount: 0, currency: "USD" };
      return res.end(JSON.stringify({ payment }));
    }
    const putOrder = /^\/v2\/orders\/(\w+)$/.exec(req.url);
    if (req.method === "PUT" && putOrder && orders.has(putOrder[1])) {
      const o = orders.get(putOrder[1]);
      if (json.order && json.order.version !== o.version) { res.statusCode = 409; return res.end(JSON.stringify({ errors: [{ code: "VERSION_MISMATCH" }] })); }
      if (json.order && json.order.state === "CANCELED") { o.state = "CANCELED"; o.version += 1; }
      return res.end(JSON.stringify({ order: o }));
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
  return { url: `http://localhost:${server.address().port}`, calls, orders, accounts, payments, set: (f) => { state.fulfillment = f; }, loyalty: (on) => { state.loyalty = on; } };
}
