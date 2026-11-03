// A stand-in for Square's Orders API, for the browser tests: it remembers the orders it is given and answers for them,
// with a fulfillment state the test can change (PROPOSED, RESERVED, PREPARED, COMPLETED, CANCELED).
import http from "node:http";

export async function startSquare() {
  const calls = [], orders = new Map();
  const state = { fulfillment: "PROPOSED" };
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const json = raw ? JSON.parse(raw) : {};
    calls.push({ method: req.method, url: req.url, json });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/v2/orders") {
      const sub = json.order.line_items.reduce((s, l) => s + l.base_price_money.amount * Number(l.quantity), 0);
      const order = { id: "SQORDER" + (orders.size + 1) + "ABCDEF", state: "OPEN", location_id: json.order.location_id, reference_id: json.order.reference_id, source: json.order.source, total_money: { amount: Math.round(sub * 1.08875), currency: "USD" }, fulfillments: [{ type: "PICKUP", state: "PROPOSED" }] };
      orders.set(order.id, order);
      return res.end(JSON.stringify({ order }));
    }
    const got = /^\/v2\/orders\/(\w+)$/.exec(req.url);
    if (req.method === "GET" && got && orders.has(got[1])) { const o = orders.get(got[1]); o.fulfillments[0].state = state.fulfillment; return res.end(JSON.stringify({ order: o })); }
    res.statusCode = 404; res.end(JSON.stringify({ errors: [{ code: "NOT_FOUND" }] }));
  });
  await new Promise((r) => server.listen(0, r));
  server.unref();
  return { url: `http://localhost:${server.address().port}`, calls, orders, set: (f) => { state.fulfillment = f; } };
}
