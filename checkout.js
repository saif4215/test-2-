// Cart + Square checkout UI. Card details go straight from Square's hosted card field to Square;
// this code only ever sees a one-time token.
const money = (c) => `$${(c / 100).toFixed(2)}`;
const ORDER_URL = "https://www.marufcafe.com/s/order";

function h(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids.filter((k) => k != null));
  return n;
}

export async function initCheckout(items) {
  /* items: Map id -> { id, name, cents } for everything that can be ordered here */
  const cfg = await fetch("/api/config", { signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const enabled = !!cfg?.enabled;
  const taxRate = (cfg?.taxPercent || 0) / 100;

  let cart = {};
  try { cart = JSON.parse(localStorage.getItem("maruf-cart") || "{}"); } catch { /* storage unavailable */ }
  for (const id of Object.keys(cart)) if (!items.has(id) || !(cart[id] > 0)) delete cart[id];
  const save = () => { try { localStorage.setItem("maruf-cart", JSON.stringify(cart)); } catch { /* ignore */ } };

  let card = null, cardState = "idle", key = crypto.randomUUID(), busy = false, done = false;

  /* ---- DOM ---- */
  const countEl = h("span", { className: "cart-count" });
  const totalEl = h("span", { className: "cart-total" });
  const fab = h("button", { type: "button", className: "cart-fab", "aria-haspopup": "dialog" }, "Order ", countEl, totalEl);
  const linesEl = h("ul", { className: "cart-lines" });
  const sumEl = h("dl", { className: "cart-sum" });
  const nameIn = h("input", { id: "co-name", type: "text", autocomplete: "name", maxLength: 60, required: true });
  const phoneIn = h("input", { id: "co-phone", type: "tel", autocomplete: "tel", placeholder: "Optional" });
  const noteIn = h("input", { id: "co-note", type: "text", maxLength: 200, placeholder: "Optional" });
  const cardBox = h("div", { id: "card-container", className: "card-box" });
  const statusEl = h("p", { className: "co-status", role: "status" });
  const payBtn = h("button", { type: "submit", className: "btn pay" }, "Pay");
  const field = (label, input) => h("label", { className: "co-field" }, h("span", {}, label), input);
  const form = h("form", { className: "co-form", noValidate: true },
    h("p", { className: "co-pickup" }, "Pickup order. We start it as soon as it is paid."),
    field("Name for the order", nameIn), field("Phone", phoneIn), field("Note for the kitchen", noteIn),
    h("span", { className: "co-label" }, "Card"), cardBox, statusEl, payBtn);
  const closeBtn = h("button", { type: "button", className: "cart-close", "aria-label": "Close order" }, "×");
  const offNote = h("div", { className: "co-off" },
    h("p", {}, "Online checkout is not switched on for this site yet."),
    h("a", { className: "btn", href: ORDER_URL }, "Order on Square Online"));
  const empty = h("p", { className: "cart-empty" }, "Your order is empty. Add something from the menu.");
  const doneEl = h("div", { className: "co-done" });
  const panel = h("aside", { className: "cart", role: "dialog", "aria-label": "Your order", hidden: true },
    h("header", {}, h("h3", {}, "Your order"), closeBtn), empty, linesEl, sumEl, enabled ? form : offNote, doneEl);
  document.body.append(fab, panel);

  /* ---- state -> DOM ---- */
  const entries = () => Object.entries(cart).map(([id, qty]) => ({ ...items.get(id), qty }));
  const subtotal = () => entries().reduce((s, l) => s + l.cents * l.qty, 0);
  const tax = () => Math.round(subtotal() * taxRate);
  const count = () => entries().reduce((s, l) => s + l.qty, 0);

  function render() {
    const n = count();
    countEl.textContent = n ? `(${n})` : "";
    totalEl.textContent = n ? money(subtotal() + tax()) : "";
    fab.hidden = n === 0 && panel.hidden;
    empty.hidden = n > 0 || done;
    linesEl.replaceChildren(...entries().map((l) => {
      const dec = h("button", { type: "button", "aria-label": `Remove one ${l.name}` }, "−");
      const inc = h("button", { type: "button", "aria-label": `Add one ${l.name}` }, "+");
      dec.onclick = () => change(l.id, -1);
      inc.onclick = () => change(l.id, +1);
      return h("li", {}, h("span", { className: "ln" }, l.name), h("span", { className: "qty" }, dec, h("b", {}, String(l.qty)), inc), h("span", { className: "lp" }, money(l.cents * l.qty)));
    }));
    sumEl.replaceChildren();
    if (n) {
      const row = (k, v, cls) => sumEl.append(h("dt", { className: cls }, k), h("dd", { className: cls }, v));
      row("Subtotal", money(subtotal()));
      if (taxRate) row("Tax (estimate)", money(tax()));
      row("Total", money(subtotal() + tax()), "grand");
    }
    form.hidden = n === 0 || done;
    offNote.hidden = n === 0 || done;
    payBtn.textContent = busy ? "Processing…" : `Pay ${money(subtotal() + tax())}`;
    payBtn.disabled = busy || n === 0 || cardState === "failed";
  }

  function change(id, d) {
    cart[id] = Math.max(0, Math.min(20, (cart[id] || 0) + d));
    if (!cart[id]) delete cart[id];
    save(); render();
    if (!count() && !panel.hidden) setStatus("");
  }

  const setStatus = (msg, bad = false) => { statusEl.textContent = msg; statusEl.dataset.bad = bad ? "1" : ""; };

  /* ---- Square card field ---- */
  function loadSquare() {
    if (window.Square) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = cfg.environment === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
      s.onload = resolve; s.onerror = () => reject(new Error("load"));
      document.head.append(s);
    });
  }
  async function ensureCard() {
    if (!enabled || card || cardState === "loading") return;
    cardState = "loading"; setStatus("Loading secure card form…");
    try {
      await loadSquare();
      const payments = window.Square.payments(cfg.appId, cfg.locationId);
      card = await payments.card();
      await card.attach("#card-container");
      cardState = "ready"; setStatus("");
    } catch {
      cardState = "failed";
      setStatus("The secure card form could not load. Check your connection, or order on Square Online.", true);
    }
    render();
  }

  /* ---- pay ---- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !count()) return;
    if (!nameIn.value.trim()) { setStatus("Enter a name for the pickup order.", true); nameIn.focus(); return; }
    if (!card) { setStatus("The card form is still loading.", true); return; }
    busy = true; setStatus(""); render();
    try {
      const t = await card.tokenize();
      if (t.status !== "OK") { setStatus(t.errors?.[0]?.message || "Check your card details and try again.", true); return; }
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Object.entries(cart).map(([id, qty]) => ({ id, qty })), name: nameIn.value, phone: phoneIn.value, note: noteIn.value, sourceId: t.token, idempotencyKey: key }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { finish(j); return; }
      if (j.uncertain) { cardState = "failed"; setStatus(j.error, true); return; }   // do not allow a second charge
      key = crypto.randomUUID();                                                       // definite failure: next try is a fresh attempt
      setStatus(j.error || "Payment failed. You were not charged.", true);
    } catch {
      setStatus("We could not reach the server. Please check your connection and try again.", true);
    } finally {
      busy = false; render();
    }
  });

  function finish(j) {
    done = true; cart = {}; save();
    doneEl.replaceChildren(
      h("h4", {}, "Order placed"),
      h("p", {}, `Total charged: ${money(j.totalCents)}. Your order number ends in ${j.orderId.slice(-6).toUpperCase()}.`),
      h("p", {}, "Show this at the counter when you arrive."),
      j.receiptUrl ? h("a", { className: "btn", href: j.receiptUrl, target: "_blank", rel: "noopener" }, "View receipt") : null);
    doneEl.hidden = false;
    key = crypto.randomUUID();
    render();
  }

  /* ---- open / close ---- */
  function open() {
    if (done) { done = false; doneEl.hidden = true; }
    panel.hidden = false; fab.hidden = true; render(); ensureCard();
    closeBtn.focus();
  }
  function close() { panel.hidden = true; fab.hidden = count() === 0; fab.focus(); }
  fab.onclick = open;
  closeBtn.onclick = close;
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });
  doneEl.hidden = true;
  render();

  return { add: (id) => { change(id, +1); if (panel.hidden) { fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump"); } }, enabled };
}
