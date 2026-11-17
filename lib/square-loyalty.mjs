// Square Loyalty: the customer's points live in the café's Square, tied to their phone number, so they are earned on app orders AND at the counter,
// and a reward comes off the bill in Square checkout (the cashier applies it: Square POS > customer's phone number > Redeem).
//
// What this file does (everything goes through `call(method, route, body)`, the server's own Square request function):
//   program()      the café's Loyalty program and its reward tiers, or null when Loyalty is not switched on in Square
//   findAccount()  the account for a phone number, or null
//   joinAccount()  the account for a phone number, made if it does not exist yet
//   accumulate()   add the points for one completed order (once: the same order is never counted twice)
//
// Written from Square's Loyalty API documentation and checked only against a stand-in. Run `npm run square-check` against your Square sandbox
// first: it says whether your Square account has an active Loyalty program.
import crypto from "node:crypto";

const key = (...parts) => crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);   // a stable idempotency key (Square allows up to 45 characters)

const isSquareError = (e) => e && typeof e.status === "number" && Array.isArray(e.errors);

/** The reward tiers customers can work toward: [{ id, name, points }], smallest first. */
export function tiersOf(program) {
  return (program?.reward_tiers || []).filter((t) => t && t.id && Number(t.points) >= 1).map((t) => { const points = Math.floor(Number(t.points)); return { id: String(t.id), name: String(t.name || `${points} points`).slice(0, 80), points }; }).sort((a, b) => a.points - b.points);
}

/** The Loyalty program, or null when the account has none, it is not active, or this Square account does not have Loyalty (no subscription or no permission). Other failures throw. */
export async function program(call) {
  try {
    const p = (await call("GET", "/v2/loyalty/programs/main")).program;
    return p && p.id && (!p.status || p.status === "ACTIVE") ? p : null;
  } catch (err) {
    if (isSquareError(err) && [400, 401, 402, 403, 404].includes(err.status)) return null;
    throw err;
  }
}

export async function findAccount(call, phone) {
  const r = await call("POST", "/v2/loyalty/accounts/search", { query: { mappings: [{ phone_number: phone }] }, limit: 1 });
  return (r.loyalty_accounts || [])[0] || null;
}

export async function joinAccount(call, programId, phone) {
  const found = await findAccount(call, phone);
  if (found) return found;
  const r = await call("POST", "/v2/loyalty/accounts", { idempotency_key: key("join", programId, phone), loyalty_account: { program_id: programId, mapping: { phone_number: phone } } });
  return r.loyalty_account;
}

/**
 * Add the points for a completed order. Square works the points out from the order itself (the program's rules and any promotion), so nothing is
 * calculated here. Safe to call again for the same order: Square either repeats the answer or says the order was already counted, and both mean "done".
 * Returns { done: true, points } or { done: false } when the order is not ready for points yet.
 */
export async function accumulate(call, accountId, orderId, locationId) {
  try {
    const r = await call("POST", `/v2/loyalty/accounts/${encodeURIComponent(accountId)}/accumulate`, { idempotency_key: key("acc", accountId, orderId), accumulate_points: { order_id: orderId }, location_id: locationId });
    const ev = (r.events || []).find((e) => e.accumulate_points) || (r.event?.accumulate_points ? r.event : null);
    return { done: true, points: Math.max(0, Math.floor(Number(ev?.accumulate_points?.points) || 0)) };
  } catch (err) {
    if (isSquareError(err)) {
      const codes = err.errors.map((e) => `${e.code} ${e.detail || ""}`).join(" ");
      if (/already|ALREADY|duplicate/i.test(codes)) return { done: true, points: 0 };   // the café's own register already counted it
      if (err.status === 400 || err.status === 404) return { done: false, reason: err.errors[0]?.code || "NOT_READY" };
    }
    throw err;
  }
}

/** { balance, lifetime } for an account object from Square. */
export const balanceOf = (account) => ({ balance: Math.max(0, Math.floor(Number(account?.balance) || 0)), lifetime: Math.max(0, Math.floor(Number(account?.lifetime_points) || 0)) });
