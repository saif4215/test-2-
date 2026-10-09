// Maruf Cafe staff dashboard. Plain JavaScript, no libraries. Everything typed by customers or staff is
// put on the page as text (never as HTML), and every change is sent with the CSRF token.
"use strict";

const app = document.getElementById("app");
let me = null, csrf = "";
const S = { tab: "requests", status: "", type: "", q: "", page: 1, content: null, slots: [], menu: null, menuCustom: false, uploads: [] };

/* ---------- small helpers ---------- */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const $ = (sel, root = document) => root.querySelector(sel);

async function api(method, route, body, opts = {}) {
  const headers = { ...(csrf ? { "X-CSRF-Token": csrf } : {}) };
  let payload;
  if (body instanceof Blob) { payload = body; if (opts.name) headers["X-Filename"] = encodeURIComponent(opts.name); }
  else if (body !== undefined) { payload = JSON.stringify(body); headers["Content-Type"] = "application/json"; }
  let res;
  try { res = await fetch(`/admin/api/${route}`, { method, headers, body: payload, credentials: "same-origin" }); }
  catch { throw new Error("Could not reach the server. Check your internet connection and try again."); }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && route !== "login") { me = null; render(); throw new Error("Please sign in again."); }
  if (!res.ok || json.ok === false) { const e = new Error(json.error || "Something went wrong. Try again."); e.status = res.status; e.errors = json.errors; throw e; }
  return json;
}

function flash(parent, text, kind = "ok") {
  $(".msg.flash", parent)?.remove();
  const m = h("p", { class: `msg flash ${kind}`, role: kind === "bad" ? "alert" : "status", text });
  parent.prepend(m);
  if (kind === "ok") setTimeout(() => m.remove(), 4000);
  return m;
}
const when = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const money = (c) => (c / 100).toFixed(2);
const toCents = (s) => { const t = String(s).replace(/[$,\s]/g, ""); return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(parseFloat(t) * 100) : NaN; };
const canManage = () => !!me?.canManageSite;

/* ---------- shell ---------- */
function render() {
  app.replaceChildren();
  if (!me) return renderLogin();
  const tabs = [["requests", "Requests"], ["menu", "Menu"], ...(canManage() ? [["site", "Site info"], ["photos", "Photos"]] : []), ...(me.role === "owner" ? [["setup", "Setup"]] : [])];
  if (!tabs.some(([k]) => k === S.tab)) S.tab = "requests";
  const main = h("main", { id: "main" });
  app.append(
    h("header", { class: "top" }, h("div", {}, h("h1", { text: "Maruf Cafe dashboard" }), h("small", { text: me.user === me.role ? me.user : `${me.user} (${me.role})` })),
      h("button", { type: "button", text: "Sign out", onclick: async () => { try { await api("POST", "logout", {}); } catch { /* already out */ } me = null; csrf = ""; render(); } })),
    h("nav", { class: "tabs", "aria-label": "Sections" }, tabs.map(([k, label]) => h("button", { type: "button", text: label, "aria-current": S.tab === k ? "page" : false, onclick: () => { S.tab = k; render(); } }))),
    main,
  );
  ({ requests: viewRequests, menu: viewMenu, site: viewSite, photos: viewPhotos, setup: viewSetup })[S.tab](main);
}

function renderLogin() {
  const msg = h("p", { class: "msg bad", role: "alert", hidden: true });
  const user = h("input", { id: "u", name: "username", autocomplete: "username", value: "owner", autocapitalize: "none" });
  const pass = h("input", { id: "p", name: "password", type: "password", autocomplete: "current-password", required: true });
  const go = h("button", { class: "primary", type: "submit", text: "Sign in" });
  const form = h("form", { class: "login", onsubmit: async (e) => {
    e.preventDefault(); go.disabled = true; msg.hidden = true;
    try { const r = await api("POST", "login", { username: user.value.trim(), password: pass.value }); me = r; csrf = r.csrf; S.tab = "requests"; render(); }
    catch (err) { msg.textContent = err.message; msg.hidden = false; go.disabled = false; pass.select(); }
  } },
    h("h1", { text: "Maruf Cafe" }), h("p", { class: "hint", text: "Staff sign-in" }), msg,
    h("label", { for: "u", text: "Username" }), user, h("label", { for: "p", text: "Password" }), pass, go);
  app.append(form);
  pass.focus();
}

/* ---------- requests ---------- */
async function viewRequests(main) {
  const list = h("div", { "aria-live": "polite" });
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filter by status" });
  const search = h("input", { type: "search", placeholder: "Search name, phone, email…", value: S.q, "aria-label": "Search requests", onchange: (e) => { S.q = e.target.value.trim(); S.page = 1; load(); } });
  const type = h("select", { "aria-label": "Type", onchange: (e) => { S.type = e.target.value; S.page = 1; load(); } },
    ...[["", "All types"], ["large-order", "Large orders"], ["event", "Event rentals"]].map(([v, t]) => h("option", { value: v, text: t, selected: S.type === v })));
  main.append(h("div", { class: "row" }, h("div", { class: "grow" }, search), type, h("a", { class: "btn", href: "/admin/api/inquiries.csv", download: "maruf-cafe-requests.csv", text: "Download spreadsheet" })), chips, list);

  async function load() {
    list.replaceChildren(h("p", { class: "loading", text: "Loading…" }));
    try {
      const qs = new URLSearchParams({ ...(S.status && { status: S.status }), ...(S.type && { type: S.type }), ...(S.q && { q: S.q }), page: S.page });
      const r = await api("GET", `inquiries?${qs}`);
      chips.replaceChildren(...[["", "All", r.counts.all], ...Object.entries(r.statuses).map(([k, label]) => [k, label, r.counts[k]])].map(([k, label, n]) =>
        h("button", { type: "button", "aria-pressed": S.status === k ? "true" : "false", text: `${label} (${n})`, onclick: () => { S.status = k; S.page = 1; load(); } })));
      list.replaceChildren();
      if (!r.rows.length) list.append(h("p", { class: "card", text: S.status || S.q || S.type ? "No requests match." : "No requests yet. New ones from the app will appear here." }));
      for (const row of r.rows) list.append(requestCard(row, r.statuses, load));
      if (r.pages > 1) list.append(h("div", { class: "row end" },
        h("button", { type: "button", text: "← Newer", disabled: S.page <= 1, onclick: () => { S.page--; load(); } }), h("span", { text: `Page ${r.page} of ${r.pages}` }),
        h("button", { type: "button", text: "Older →", disabled: S.page >= r.pages, onclick: () => { S.page++; load(); } })));
    } catch (err) { list.replaceChildren(h("p", { class: "msg bad", role: "alert", text: err.message })); }
  }
  load();
}

function requestCard(r, statuses, reload) {
  const f = r.fields, who = f.fullName || f.name || "(no name)";
  const size = f.people ? `${f.people} people` : f.guests ? `${f.guests} guests` : "";
  const date = r.view.find(([l]) => /^(Date needed|Event date)$/.test(l))?.[1];
  const notifyMsg = { sent: "", partial: "Only some notifications went out", failed: "Notification failed: check Setup", not_configured: "No notification set up", not_recorded: "" }[r.notifyStatus] ?? "";
  const wrap = h("div", { class: "card" });
  const head = h("button", { type: "button", class: "req", "aria-expanded": "false" },
    h("b", {}, who, " ", h("span", { class: `badge ${r.status}`, text: statuses[r.status] })),
    h("span", { text: [r.title, size, date].filter(Boolean).join(" · ") }), h("br"), h("span", { text: `Received ${when(r.receivedAt)}${notifyMsg ? " · " + notifyMsg : ""}` }));
  const body = h("div", { hidden: true });
  head.addEventListener("click", () => { body.hidden = !body.hidden; head.setAttribute("aria-expanded", String(!body.hidden)); });
  const statusSel = h("select", { id: `st-${r.id}` }, ...Object.entries(statuses).map(([k, label]) => h("option", { value: k, text: label, selected: r.status === k })));
  const notes = h("textarea", { id: `nt-${r.id}`, maxlength: "4000", text: r.notes });
  const phoneDigits = (f.phone || "").replace(/[^\d+]/g, "");
  const save = h("button", { class: "primary", type: "button", text: "Save", onclick: async () => {
    save.disabled = true;
    try { const res = await api("PATCH", `inquiries/${r.id}`, { status: statusSel.value, notes: notes.value }); flash(body, "Saved."); Object.assign(r, res.request); head.querySelector(".badge").textContent = statuses[res.request.status]; head.querySelector(".badge").className = `badge ${res.request.status}`; }
    catch (err) { flash(body, err.message, "bad"); } finally { save.disabled = false; }
  } });
  body.append(
    h("dl", { class: "facts" }, r.view.flatMap(([k, v]) => [h("dt", { text: k }), h("dd", { text: v })])),
    h("div", { class: "row" },
      phoneDigits && h("a", { class: "btn", href: `tel:${phoneDigits}`, text: "Call" }), phoneDigits && h("a", { class: "btn", href: `sms:${phoneDigits}`, text: "Text" }),
      f.email && h("a", { class: "btn", href: `mailto:${f.email}`, text: "Email" })),
    h("label", { for: statusSel.id, text: "Status" }), statusSel,
    h("p", { class: "hint", text: "“Accepted” is only a note for you. It does not book anything or message the customer." }),
    h("label", { for: notes.id, text: "Private notes (customers never see these)" }), notes,
    h("div", { class: "row end" }, save),
    r.updatedBy && h("p", { class: "hint", text: `Last changed by ${r.updatedBy}, ${when(r.updatedAt)}` }));
  wrap.append(head, body);
  return wrap;
}

/* ---------- menu ---------- */
async function viewMenu(main) {
  if (!S.menu) { try { const r = await api("GET", "menu"); S.menu = r.menu; S.menuCustom = r.custom; } catch (err) { return main.append(h("p", { class: "msg bad", text: err.message })); } }
  const filter = h("input", { type: "search", placeholder: "Find an item…", "aria-label": "Find a menu item", oninput: apply });
  const tree = h("div");
  main.append(
    h("p", { class: "hint", text: "Change a name or price, tick “Hide” to take an item off the app, or “Show on Home” to feature up to 4 items on the app’s home screen, then press Save. Prices are in dollars. For a size-based price, use the low and high boxes." }),
    h("div", { class: "row" }, h("div", { class: "grow" }, filter), me.role === "owner" && h("button", { type: "button", text: "Reset to the original menu", class: "danger", onclick: async () => {
      if (!confirm("Throw away all your menu edits and go back to the original menu?")) return;
      try { const r = await api("DELETE", "menu"); S.menu = r.menu; render(); } catch (err) { flash(main, err.message, "bad"); } } })),
    tree);

  function itemRow(it) {
    const ranged = it.cents == null;
    const name = h("input", { value: it.name, "aria-label": "Item name", maxlength: "80", "data-f": "name" });
    const price = ranged
      ? h("div", { class: "range" }, h("input", { inputmode: "decimal", value: money(it.min), "aria-label": "Low price in dollars", "data-f": "min" }), h("input", { inputmode: "decimal", value: money(it.max), "aria-label": "High price in dollars", "data-f": "max" }))
      : h("input", { inputmode: "decimal", value: money(it.cents), "aria-label": "Price in dollars", "data-f": "cents" });
    const desc = h("input", { class: "desc", value: it.desc || "", placeholder: "Description (optional)", "aria-label": "Description", maxlength: "300", "data-f": "desc" });
    const pick = h("label", { class: "check" }, h("input", { type: "checkbox", checked: it.featured, "data-f": "featured" }), "Show on Home");
    const hide = h("label", { class: "check" }, h("input", { type: "checkbox", checked: it.hidden, "data-f": "hidden", onchange: (e) => row.classList.toggle("hiddenitem", e.target.checked) }), "Hide");
    const del = h("button", { type: "button", class: "danger", "aria-label": `Delete ${it.name}`, text: "✕", onclick: () => { if (confirm(`Delete “${name.value}”?`)) row.remove(); } });
    const row = h("div", { class: `item${it.hidden ? " hiddenitem" : ""}`, "data-id": it.id }, name, price, del, desc, h("div", { class: "row" }, pick, hide));
    return row;
  }

  function build() {
    tree.replaceChildren();
    for (const [g, cats] of Object.entries(S.menu.groups)) {
      const group = h("details", { class: "group", open: false, "data-group": g }, h("summary", { text: g }));
      for (const [c, items] of Object.entries(cats)) {
        const list = h("div", { "data-items": "1" }, items.map(itemRow));
        const add = h("button", { type: "button", text: `+ Add an item to ${c}`, onclick: () => { const r = itemRow({ name: "", cents: 0 }); list.append(r); r.querySelector("input").focus(); } });
        group.append(h("div", { class: "card cat", "data-cat": c }, h("h3", { text: c }), list, add));
      }
      tree.append(group);
    }
  }
  function apply() {
    const q = filter.value.trim().toLowerCase();
    for (const row of tree.querySelectorAll(".item")) row.hidden = !!q && !row.querySelector("[data-f=name]").value.toLowerCase().includes(q);
    for (const d of tree.querySelectorAll("details.group")) { if (q) d.open = true; }
  }
  build();

  function collect() {
    const out = { currency: "USD", groups: {} }, problems = [];
    for (const group of tree.querySelectorAll("details.group")) {
      const g = group.dataset.group; out.groups[g] = {};
      for (const cat of group.querySelectorAll("[data-cat]")) {
        const items = [];
        for (const row of cat.querySelectorAll(".item")) {
          const val = (f) => row.querySelector(`[data-f=${f}]`)?.value ?? "";
          const it = { id: row.dataset.id || undefined, name: val("name").trim() };
          if (!it.name) { problems.push("Every item needs a name."); row.classList.add("bad"); continue; }
          if (row.querySelector("[data-f=cents]")) { it.cents = toCents(val("cents")); if (Number.isNaN(it.cents)) problems.push(`“${it.name}” needs a price like 4.50.`); }
          else { it.min = toCents(val("min")); it.max = toCents(val("max")); if (Number.isNaN(it.min) || Number.isNaN(it.max) || it.min > it.max) problems.push(`“${it.name}” needs a low and a high price (low first).`); }
          const d = val("desc").trim(); if (d) it.desc = d;
          if (row.querySelector("[data-f=hidden]").checked) it.hidden = true;
          else if (row.querySelector("[data-f=featured]").checked) it.featured = true;
          items.push(it);
        }
        out.groups[g][cat.dataset.cat] = items;
      }
    }
    return { menu: out, problems: [...new Set(problems)] };
  }
  const msgBox = h("span");
  const save = h("button", { class: "primary", type: "button", text: "Save menu", onclick: async () => {
    const { menu, problems } = collect();
    msgBox.replaceChildren();
    if (problems.length) return msgBox.append(h("span", { class: "msg bad", role: "alert", text: problems[0] }));
    save.disabled = true;
    try { const r = await api("PUT", "menu", { menu }); S.menu = r.menu; build(); apply(); msgBox.append(h("span", { class: "msg ok", role: "status", text: "Saved. The app shows it now." })); }
    catch (err) { msgBox.append(h("span", { class: "msg bad", role: "alert", text: err.message })); } finally { save.disabled = false; }
  } });
  main.append(h("div", { class: "savebar" }, msgBox, save));
}

/* ---------- site info ---------- */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourOptions = () => Array.from({ length: 49 }, (_, i) => i / 2).map((v) => ({ v, t: `${Math.floor(v) % 24 % 12 || 12}${v % 1 ? ":30" : ":00"} ${Math.floor(v) % 24 < 12 ? "AM" : "PM"}${v === 24 ? " (midnight)" : ""}` }));

async function loadContent() {
  if (S.content) return true;
  const r = await api("GET", "content");
  S.content = r.content; S.slots = r.slots;
  return true;
}
const SLOT_LABELS = { hero: "Top of the home page", largeOrders: "Large orders page", catering: "Catering section", interior: "Inside the café", interior2: "Inside the café (second)", event: "Event / rental page" };

async function saveContent(host, button) {
  button.disabled = true;
  try { const r = await api("PUT", "content", { content: S.content }); S.content = r.content; flash(host, "Saved. The app shows it now."); }
  catch (err) { flash(host, err.errors?.length > 1 ? `${err.errors[0]} (and ${err.errors.length - 1} more)` : err.message, "bad"); }
  finally { button.disabled = false; }
}

async function viewSite(main) {
  try { await loadContent(); } catch (err) { return main.append(h("p", { class: "msg bad", text: err.message })); }
  const c = S.content, b = c.business;
  const bind = (obj, key, label, opts = {}) => {
    const id = `f-${Math.random().toString(36).slice(2, 8)}`;
    const el = h(opts.area ? "textarea" : "input", { id, value: obj[key] ?? "", maxlength: opts.max || "200", inputmode: opts.mode, placeholder: opts.ph, oninput: (e) => { obj[key] = e.target.value; } });
    if (opts.area) el.textContent = obj[key] ?? "";
    return [h("label", { for: id, text: label }), el, opts.hint && h("p", { class: "hint", text: opts.hint })];
  };
  const address = { l1: b.address[0] || "", l2: b.address[1] || "" };
  const syncAddr = () => { b.address = [address.l1, address.l2].map((s) => s.trim()).filter(Boolean); };

  const hoursBox = h("div");
  function drawHours() {
    hoursBox.replaceChildren(...b.hours.map((hr, i) => h("div", { class: "card" },
      ...bind(hr, "label", "Label (for example Mon – Fri)", { max: "40" }),
      h("p", { class: "hint", text: "Days" }), h("div", { class: "days" }, DAY_NAMES.map((n, d) => h("label", {}, h("input", { type: "checkbox", checked: hr.days.includes(d), onchange: (e) => { hr.days = e.target.checked ? [...new Set([...hr.days, d])].sort() : hr.days.filter((x) => x !== d); } }), n))),
      h("div", { class: "grid2" },
        h("label", {}, "Opens", h("select", { onchange: (e) => { hr.open = Number(e.target.value); } }, hourOptions().filter((o) => o.v < 24).map((o) => h("option", { value: o.v, text: o.t, selected: o.v === hr.open })))),
        h("label", {}, "Closes", h("select", { onchange: (e) => { hr.close = Number(e.target.value); } }, hourOptions().filter((o) => o.v > 0).map((o) => h("option", { value: o.v, text: o.t, selected: o.v === hr.close }))))),
      h("button", { type: "button", class: "danger", text: "Remove these hours", onclick: () => { b.hours.splice(i, 1); drawHours(); } }))),
      h("button", { type: "button", text: "+ Add hours", onclick: () => { b.hours.push({ label: "", days: [], open: 9, close: 17 }); drawHours(); } }));
  }
  drawHours();

  const listEditor = (arr, make, fields, addLabel, move = false) => {
    const box = h("div");
    const draw = () => {
      box.replaceChildren(...arr.map((it, i) => h("div", { class: "card" }, fields(it), h("div", { class: "row" },
        move && h("button", { type: "button", text: "↑", "aria-label": "Move up", disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); } }),
        move && h("button", { type: "button", text: "↓", "aria-label": "Move down", disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; draw(); } }),
        h("button", { type: "button", class: "danger", text: "Remove", onclick: () => { arr.splice(i, 1); draw(); } })))),
        h("button", { type: "button", text: addLabel, onclick: () => { arr.push(make()); draw(); } }));
    };
    draw();
    return box;
  };

  const faqBox = listEditor(c.faq, () => ({ q: "", a: "" }), (it) => [...bind(it, "q", "Question"), ...bind(it, "a", "Answer", { area: true, max: "1500" })], "+ Add a question", true);
  const pkgBox = listEditor(c.packages, () => ({ id: "", title: "", blurb: "", includes: [], price: "" }), (it) => {
    const inc = { v: it.includes.join("\n") };
    return [...bind(it, "title", "Name", { max: "60" }), ...bind(it, "blurb", "One-line description"),
      h("label", {}, "What is included (one per line)", h("textarea", { oninput: (e) => { it.includes = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); }, text: inc.v })),
      ...bind(it, "price", "Price (leave blank to show no price)", { max: "60", hint: "Only type a price you are ready to stand behind." })];
  }, "+ Add an option", true);
  const revBox = listEditor(c.reviews, () => ({ name: "", source: "", date: "", text: "", url: "" }), (it) => [...bind(it, "name", "Customer name (as they want it shown)", { max: "60" }), ...bind(it, "source", "Where it was posted (Google, Instagram, in person…)", { max: "60" }),
    ...bind(it, "date", "Date (optional, like 2026-03-14)", { max: "20" }), ...bind(it, "text", "What they wrote", { area: true, max: "1200" }), ...bind(it, "url", "Link to the original (optional, https://…)", { max: "400" })], "+ Add a review");

  const host = h("div");
  const save = h("button", { class: "primary", type: "button", text: "Save changes", onclick: () => { syncAddr(); saveContent(host, save); } });
  host.append(
    h("div", { class: "card" }, h("h2", { text: "Contact" }),
      ...bind(b, "phone", "Phone number", { mode: "tel", max: "30" }), ...bind(b, "email", "Email address (shown to customers)", { mode: "email", hint: "Leave blank to show no email in the app." }),
      ...bind(address, "l1", "Street address", { max: "100" }), ...bind(address, "l2", "City, state ZIP", { max: "100", ph: "Staten Island, NY 10309" }),
      ...bind(b, "instagram", "Instagram link", { ph: "https://www.instagram.com/…", max: "400" }), ...bind(b, "tiktok", "TikTok link", { ph: "https://www.tiktok.com/@…", max: "400" }),
      ...bind(b, "reviewsUrl", "Link to your reviews page (optional)", { ph: "https://…", max: "400" })),
    h("div", { class: "card" }, h("h2", { text: "Hours" }), h("p", { class: "hint", text: "Used in the app. Hours can change on holidays: update them here." }), hoursBox),
    h("div", { class: "card" }, h("h2", { text: "Rent the café: facts" }), h("p", { class: "hint", text: "These show on the Rent the Café page only when you fill them in. Nothing is guessed." }),
      ...bind(c.venue, "capacity", "How many people the space holds", { max: "80", ph: "for example: up to 40 seated" }), ...bind(c.venue, "notes", "About the space", { area: true, max: "1000" }),
      ...bind(c.venue, "policies", "Rental rules (deposit, cancellation, food rules…)", { area: true, max: "1500", hint: "Write your real policies here before taking bookings." })),
    h("div", { class: "card" }, h("h2", { text: "Home picks" }), h("p", { class: "hint", text: "Items ticked “Show on Home” in the Menu tab appear on the app's home screen under this title. Only call it “Most popular” if your sales show that." }),
      ...bind(c, "featuredTitle", "Title", { max: "40", ph: "Try these" })),
    h("div", { class: "card" }, h("h2", { text: "Event options" }), pkgBox, ...bind(c, "packagesNote", "Note under the options", { area: true, max: "500" })),
    h("div", { class: "card" }, h("h2", { text: "Questions & answers" }), faqBox),
    h("div", { class: "card" }, h("h2", { text: "Customer reviews" }), h("p", { class: "msg warn", text: "Only add reviews that real customers actually wrote, and use their real words. Never write or change a review yourself. Reviews show in the app only when you add them here." }), revBox),
    h("div", { class: "savebar" }, save));
  main.append(host);
}

/* ---------- photos ---------- */
async function shrink(file) {
  // Phone photos are big. Shrink them in the browser so uploads are quick and pages load fast.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5e6) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file; }
}

async function viewPhotos(main) {
  try { await loadContent(); S.uploads = (await api("GET", "uploads")).uploads; } catch (err) { return main.append(h("p", { class: "msg bad", text: err.message })); }
  const c = S.content;
  const host = h("div");
  const note = h("p", { class: "hint", text: "Upload real photos of the café, the food and your events. Photos you upload are public once you put them on a page." });
  const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, id: "pick", "aria-label": "Choose photos" });
  const status = h("div");
  const up = h("button", { type: "button", class: "primary", text: "Upload", onclick: async () => {
    const files = [...file.files];
    if (!files.length) return flash(status, "Choose one or more photos first.", "bad");
    up.disabled = true; let done = 0;
    for (const f of files) {
      try { await api("POST", "uploads", await shrink(f), { name: f.name }); done++; }
      catch (err) { flash(status, `${f.name}: ${err.message}`, "bad"); }
    }
    file.value = ""; up.disabled = false;
    if (done) { flash(status, `${done} photo${done > 1 ? "s" : ""} uploaded.`); S.uploads = (await api("GET", "uploads")).uploads; drawGrid(); }
  } });
  const spots = h("div"), gallery = h("div"), grid = h("div", { class: "photos" });
  const urlIn = (url) => S.uploads.find((u) => u.url === url);

  function drawSpots() {
    spots.replaceChildren(h("h2", { text: "Photo spots" }), h("p", { class: "hint", text: "Pick which photo goes where. Empty spots stay hidden." }),
      ...S.slots.map((slot) => {
        const cur = c.photos[slot] || "";
        return h("div", { class: "card" }, h("label", {}, SLOT_LABELS[slot] || slot,
          h("select", { onchange: (e) => { if (e.target.value) c.photos[slot] = e.target.value; else delete c.photos[slot]; } },
            h("option", { value: "", text: "No photo" }), ...S.uploads.map((u) => h("option", { value: u.url, text: u.original || u.file.slice(0, 8), selected: u.url === cur })))));
      }));
  }
  function drawGallery() {
    gallery.replaceChildren(h("h2", { text: "Gallery" }), h("p", { class: "hint", text: "These appear in the Gallery section. Every photo needs a short description for people who use screen readers, and it helps Google too." }),
      ...c.gallery.map((g, i) => h("div", { class: "card" },
        h("img", { src: g.url, alt: g.alt || "", width: "120", class: "thumb" }),
        h("label", {}, "Description (required)", h("input", { value: g.alt, maxlength: "160", oninput: (e) => { g.alt = e.target.value; } })),
        h("label", {}, "Caption (optional)", h("input", { value: g.caption || "", maxlength: "160", oninput: (e) => { g.caption = e.target.value; } })),
        h("div", { class: "row" },
          h("button", { type: "button", text: "↑", "aria-label": "Move up", disabled: i === 0, onclick: () => { [c.gallery[i - 1], c.gallery[i]] = [c.gallery[i], c.gallery[i - 1]]; drawGallery(); } }),
          h("button", { type: "button", text: "↓", "aria-label": "Move down", disabled: i === c.gallery.length - 1, onclick: () => { [c.gallery[i + 1], c.gallery[i]] = [c.gallery[i], c.gallery[i + 1]]; drawGallery(); } }),
          h("button", { type: "button", class: "danger", text: "Remove from gallery", onclick: () => { c.gallery.splice(i, 1); drawGallery(); drawGrid(); } })))));
  }
  function drawGrid() {
    const used = (u) => c.gallery.some((g) => g.url === u.url) || Object.values(c.photos).includes(u.url);
    grid.replaceChildren(...S.uploads.map((u) => h("div", { class: "photo" }, h("img", { src: u.url, alt: u.original || "Uploaded photo", loading: "lazy" }), h("div", { text: u.original || u.file.slice(0, 8) }),
      h("button", { type: "button", text: c.gallery.some((g) => g.url === u.url) ? "In gallery ✓" : "Add to gallery", disabled: c.gallery.some((g) => g.url === u.url), onclick: () => { c.gallery.push({ url: u.url, alt: "", caption: "" }); drawGallery(); drawGrid(); } }),
      h("button", { type: "button", class: "danger", text: "Delete", onclick: async () => {
        if (!confirm("Delete this photo for good?")) return;
        try { await api("DELETE", `uploads/${u.id}`); S.uploads = S.uploads.filter((x) => x.id !== u.id); drawGrid(); drawSpots(); }
        catch (err) { flash(status, used(u) ? "This photo is still used. Remove it from its spot or the gallery, press Save, then delete it." : err.message, "bad"); }
      } }))));
    if (!S.uploads.length) grid.replaceChildren(h("p", { class: "card", text: "No photos yet." }));
  }
  const save = h("button", { class: "primary", type: "button", text: "Save changes", onclick: () => saveContent(host, save) });
  host.append(note, h("div", { class: "card" }, h("label", { for: "pick", text: "Add photos (JPEG, PNG or WebP)" }), file, h("div", { class: "row end" }, up), status), spots, gallery, h("h2", { text: "All uploaded photos" }), grid, h("div", { class: "savebar" }, save));
  main.append(host);
  drawSpots(); drawGallery(); drawGrid();
}

/* ---------- setup ---------- */
async function viewSetup(main) {
  try {
    const s = await api("GET", "status"), a = await api("GET", "audit");
    const check = (ok, good, bad) => h("li", { class: ok ? "check-ok" : "check-no", text: ok ? good : bad });
    main.append(
      h("div", { class: "card" }, h("h2", { text: "Is everything switched on?" }), h("ul", { class: "plain" },
        check(true, "Requests are saved in the database.", ""),
        check(s.email, "Email alerts are on. New requests are emailed to you.", "Email alerts are OFF. Set RESEND_API_KEY and NOTIFY_EMAIL (see DEPLOY.md), or you will only see requests here."),
        check(s.email || s.webhook, "You are alerted when a request arrives.", "Nothing alerts you when a request arrives. Add email alerts or a webhook."),
        check(s.square !== "off", `Online card checkout is on (${s.square}).`, "Online card checkout is off. That is fine until you set up Square."),
        check(s.assistant, "The AI assistant in the app is on.", "The AI assistant in the app is off (optional). Set ANTHROPIC_API_KEY to turn it on."),
        check(s.publicUrl, "The server address is set (links in emails are right).", "PUBLIC_URL is not set. Emails will not include a dashboard link."),
        check(s.staffAccount, "A staff account is set up.", "No staff account. Set STAFF_PASSWORD (10+ characters) to give staff their own sign-in."),
        ...s.warnings.map((w) => check(false, "", w)))),
      h("div", { class: "card" }, h("h2", { text: "Request counts" }), h("p", { text: Object.entries(s.counts).map(([k, n]) => `${k.replace("_", " ")}: ${n}`).join(" · ") })),
      h("div", { class: "card" }, h("h2", { text: "Recent changes" }), h("ul", { class: "plain" }, a.entries.length ? a.entries.slice(0, 40).map((e) => h("li", { text: `${when(e.at)} · ${e.user} · ${e.action}${e.detail ? " · " + e.detail : ""}` })) : h("li", { text: "Nothing yet." }))));
  } catch (err) { main.append(h("p", { class: "msg bad", text: err.message })); }
}

/* ---------- start ---------- */
(async () => {
  try { const r = await fetch("/admin/api/me", { credentials: "same-origin" }); if (r.ok) { me = await r.json(); csrf = me.csrf; } else if (r.status === 404) { app.replaceChildren(h("p", { class: "loading", text: "The staff dashboard is switched off. Set ADMIN_PASSWORD on the server to turn it on." })); return; } }
  catch { /* show the sign-in page; it reports connection problems itself */ }
  render();
})();
