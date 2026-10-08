// Quote and event request forms for the Large Orders and Rent the Café pages.
// A form only says "sent" after the server has answered that it saved the request. If anything fails the
// customer is told plainly, keeps what they typed, and is given the phone number.
const OCCASIONS = ["Birthday", "Family gathering", "Office or business meeting", "School event", "Community event", "Holiday gathering", "Party or celebration", "Other"];
const EVENT_TYPES = ["Birthday party", "Engagement", "Family gathering", "Private dinner", "Business meeting", "Community event", "Celebration", "Other"];
const YNU = [["", "Not sure yet"], ["yes", "Yes"], ["no", "No"]];

// kind: text | tel | email | number | date | time | select | choice | area | hidden
const FORMS = {
  "large-order": {
    submit: "Send my quote request",
    groups: [
      ["About you", [
        { k: "fullName", l: "Full name", kind: "text", req: true, auto: "name" },
        { row: [{ k: "phone", l: "Phone", kind: "tel", req: true, auto: "tel" }, { k: "email", l: "Email", kind: "email", req: true, auto: "email" }] },
        { k: "contactMethod", l: "Best way to reach you", kind: "choice", opt: true, choices: [["phone", "Phone call"], ["text", "Text"], ["email", "Email"]] },
      ]],
      ["Your order", [
        { row: [{ k: "dateNeeded", l: "Date needed", kind: "date", req: true }, { k: "people", l: "Number of people", kind: "number", req: true, min: 1, max: 5000, ph: "for example 40" }] },
        { k: "fulfillment", l: "Pickup or delivery?", kind: "choice", req: true, choices: [["pickup", "Pickup"], ["delivery", "Delivery"]] },
        { k: "deliveryAddress", l: "Delivery address", kind: "text", auto: "street-address", showIf: ["fulfillment", "delivery"], hint: "Maruf Cafe will confirm whether delivery is possible for your location." },
        { k: "pickupTime", l: "Preferred pickup or delivery time", kind: "time", opt: true },
        { k: "occasion", l: "Occasion", kind: "select", opt: true, options: OCCASIONS },
        { k: "foodItems", l: "What would you like?", kind: "area", req: true, ph: "For example: 6 trays of chicken, 2 trays of rice, drinks for 40", hint: "Menu items, trays, drinks, desserts. Rough ideas are fine." },
        { k: "dietary", l: "Allergies or dietary needs", kind: "area", opt: true, ph: "Nut allergy, vegetarian, halal, gluten-free…" },
        { k: "budget", l: "Budget", kind: "text", opt: true, ph: "for example $500, or leave blank", hint: "Helps us suggest the right amount of food." },
        { k: "specialRequests", l: "Anything else?", kind: "area", opt: true },
      ]],
    ],
  },
  event: {
    submit: "Send my event request",
    groups: [
      ["About you", [
        { k: "name", l: "Your name", kind: "text", req: true, auto: "name" },
        { row: [{ k: "phone", l: "Phone", kind: "tel", req: true, auto: "tel" }, { k: "email", l: "Email", kind: "email", req: true, auto: "email" }] },
        { k: "contactMethod", l: "Best way to reach you", kind: "choice", opt: true, choices: [["phone", "Phone call"], ["text", "Text"], ["email", "Email"]] },
      ]],
      ["Your event", [
        { k: "eventType", l: "Type of event", kind: "select", req: true, options: EVENT_TYPES },
        { row: [{ k: "eventDate", l: "Event date", kind: "date", req: true }, { k: "alternateDate", l: "Backup date", kind: "date", opt: true }] },
        { row: [{ k: "startTime", l: "Start time", kind: "time", opt: true }, { k: "endTime", l: "End time", kind: "time", opt: true }] },
        { k: "guests", l: "Number of guests", kind: "number", req: true, min: 1, max: 1000, ph: "for example 30" },
        { k: "venueType", l: "What are you hoping to rent?", kind: "select", opt: true, choices: [["full-venue", "The whole café"], ["partial-area", "A private area"], ["private-event", "A private event"], ["other", "Something else"]] },
        { k: "packageInterest", l: "Option you are interested in", kind: "select", opt: true, fromPackages: true },
      ]],
      ["Food and extras", [
        { row: [{ k: "needFood", l: "Will you need food?", kind: "select", opt: true, choices: YNU }, { k: "catering", l: "Catering required?", kind: "select", opt: true, choices: YNU }] },
        { row: [{ k: "foodBudget", l: "Food budget", kind: "text", opt: true, ph: "optional" }, { k: "budget", l: "Overall event budget", kind: "text", opt: true, ph: "optional" }] },
        { k: "dietary", l: "Allergies or dietary needs", kind: "area", opt: true },
        { k: "decorations", l: "Decorations", kind: "area", opt: true, ph: "Tell us what you would like to bring or set up" },
        { k: "entertainment", l: "Entertainment", kind: "area", opt: true, ph: "Music, DJ, speakers…" },
        { k: "specialRequests", l: "Special requests", kind: "area", opt: true },
      ]],
    ],
  },
};

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v); }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
};
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function buildField(f, ids, packages) {
  const id = `f-${f.k}`;
  const err = el("p", { class: "err", id: `${id}-err`, hidden: true });
  const hint = f.hint && el("p", { class: "hint", id: `${id}-hint`, text: f.hint });
  const describe = [hint && hint.id, err.id].filter(Boolean).join(" ");
  const label = el("label", { for: id }, f.l, f.opt ? el("span", { class: "opt", text: " (optional)" }) : null);
  let input;
  const common = { id, name: f.k, "aria-describedby": describe, required: f.req || null, autocomplete: f.auto || "off" };
  if (f.kind === "area") input = el("textarea", { ...common, rows: 4, placeholder: f.ph, maxlength: 2000 });
  else if (f.kind === "select") {
    const opts = f.fromPackages ? [["", "Not sure yet"], ...packages.map((p) => [p, p])] : f.options ? [["", "Choose…"], ...f.options.map((o) => [o, o])] : [["", "Choose…"], ...f.choices];
    if (f.fromPackages && !packages.length) return null;
    input = el("select", common, opts.map(([v, t]) => el("option", { value: v, text: t })));
  } else if (f.kind === "choice") {
    const name = f.k;
    const group = el("div", { class: "choice", role: "radiogroup", "aria-labelledby": `${id}-lab`, "aria-describedby": describe, id },
      f.choices.map(([v, t], i) => el("label", {}, el("input", { type: "radio", name, value: v, required: f.req && i === 0 ? true : null }), t)));
    const wrap = el("div", { class: "f", "data-field": f.k }, el("span", { class: "lab", id: `${id}-lab` }, f.l, f.opt ? el("span", { class: "opt", text: " (optional)" }) : null), group, hint, err);
    return wrap;
  } else {
    const type = { text: "text", tel: "tel", email: "email", number: "number", date: "date", time: "time" }[f.kind];
    input = el("input", { ...common, type, placeholder: f.ph, inputmode: f.kind === "number" ? "numeric" : f.kind === "tel" ? "tel" : null, min: f.min, max: f.max, maxlength: f.kind === "text" ? 250 : null, autocapitalize: f.kind === "email" ? "none" : null });
  }
  if (f.kind === "date") input.setAttribute("min", todayLocal());
  return el("div", { class: "f", "data-field": f.k }, label, input, hint, err);
}

function mount(host) {
  const type = host.dataset.form, cfg = FORMS[type];
  const phone = host.dataset.phone || "", tel = host.dataset.tel || "";
  const packages = [...document.querySelectorAll(".package h3")].map((n) => n.textContent.trim());
  const form = el("form", { class: "request-form", novalidate: true, "aria-label": cfg.submit });
  const banner = el("div", { role: "alert" });
  const submit = el("button", { class: "btn submit", type: "submit", text: cfg.submit });
  const hp = el("div", { class: "hp", "aria-hidden": "true" }, el("label", { for: "f-website", text: "Leave this empty" }), el("input", { id: "f-website", name: "website", tabindex: "-1", autocomplete: "off" }));
  form.append(banner);
  for (const [title, fields] of cfg.groups) {
    form.append(el("fieldset", {}, el("legend", { text: title }), fields.map((f) => f.row ? el("div", { class: "f-row" }, f.row.map((x) => buildField(x, null, packages))) : buildField(f, null, packages))));
  }
  form.append(hp, submit, el("p", { class: "fine", text: "Sending a request does not book anything and does not charge you. Maruf Cafe will contact you to confirm the details." }));
  host.replaceChildren(form);

  const all = cfg.groups.flatMap(([, fs]) => fs.flatMap((f) => f.row || [f]));
  const byKey = Object.fromEntries(all.map((f) => [f.k, f]));
  const wrapOf = (k) => form.querySelector(`[data-field="${k}"]`);
  const valueOf = (k) => { const f = byKey[k]; if (!f) return ""; if (f.kind === "choice") return form.querySelector(`input[name="${k}"]:checked`)?.value || ""; return (form.elements[k]?.value || "").trim(); };

  // Show "delivery address" only for delivery.
  for (const f of all) if (f.showIf) {
    const w = wrapOf(f.k), update = () => { const on = valueOf(f.showIf[0]) === f.showIf[1]; w.hidden = !on; };
    form.addEventListener("change", update); update();
  }
  // Pre-fill the option the customer clicked on ("Ask about this").
  const preset = new URLSearchParams(location.search).get("package");
  if (preset && form.elements.packageInterest) form.elements.packageInterest.value = [...form.elements.packageInterest.options].find((o) => o.value === preset)?.value || "";
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("[data-package]");
    if (!a || !form.elements.packageInterest) return;
    const v = a.dataset.package;
    if ([...form.elements.packageInterest.options].some((o) => o.value === v)) form.elements.packageInterest.value = v;
  });

  const setError = (k, msg) => {
    const w = wrapOf(k); if (!w) return;
    const e = w.querySelector(".err"), input = w.querySelector("input,select,textarea");
    e.textContent = msg || ""; e.hidden = !msg;
    w.querySelectorAll("input,select,textarea").forEach((i) => (msg ? i.setAttribute("aria-invalid", "true") : i.removeAttribute("aria-invalid")));
    return input;
  };

  function check() {
    const problems = {};
    const today = todayLocal();
    for (const f of all) {
      const w = wrapOf(f.k); if (!w || w.hidden) continue;
      const v = valueOf(f.k);
      if (f.req && !v) { problems[f.k] = f.kind === "choice" ? "Please choose one." : "Please fill this in."; continue; }
      if (!v) continue;
      if (f.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) problems[f.k] = "That email address does not look right.";
      if (f.kind === "tel" && v.replace(/\D/g, "").length < 7) problems[f.k] = "Enter a phone number we can call, with area code.";
      if (f.kind === "number" && !(Number.isInteger(Number(v)) && Number(v) >= f.min && Number(v) <= f.max)) problems[f.k] = `Enter a whole number from ${f.min} to ${f.max}.`;
      if (f.kind === "date" && v < today) problems[f.k] = "Please choose a date that has not passed.";
    }
    if (valueOf("fulfillment") === "delivery" && !valueOf("deliveryAddress")) problems.deliveryAddress = "Enter the address to deliver to.";
    if (byKey.startTime && valueOf("startTime") && valueOf("endTime") && valueOf("endTime") <= valueOf("startTime")) problems.endTime = "The end time must be after the start time.";
    return problems;
  }

  function showProblems(problems, serverMessage) {
    for (const f of all) setError(f.k, problems[f.k]);
    const keys = Object.keys(problems);
    banner.replaceChildren();
    if (keys.length) {
      banner.append(el("p", { class: "form-banner bad", text: serverMessage || `Please fix ${keys.length === 1 ? "the highlighted field" : `the ${keys.length} highlighted fields`} and send again.` }));
      const first = setError(keys[0], problems[keys[0]]); first?.focus({ preventScroll: false }); first?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  }
  form.addEventListener("input", (e) => { const w = e.target.closest?.("[data-field]"); if (w && !w.querySelector(".err").hidden) setError(w.dataset.field, ""); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const problems = check();
    if (Object.keys(problems).length) return showProblems(problems);
    showProblems({});
    const fields = {};
    for (const f of all) { const w = wrapOf(f.k); if (w && !w.hidden) { const v = valueOf(f.k); if (v) fields[f.k] = v; } }
    submit.disabled = true; submit.textContent = "Sending…";
    try {
      const res = await fetch("/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, fields, website: form.elements.website.value }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok === true) return thanks(host, type, fields, phone, tel);
      if (res.status === 400 && Array.isArray(data.fields)) return showProblems(Object.fromEntries(data.fields.map((k) => [k, "Please check this."])), data.error);
      throw new Error(data.error || "");
    } catch (err) {
      banner.replaceChildren(el("div", { class: "form-banner bad" },
        el("strong", { text: "Your request was not sent. " }), err.message && !/fetch|network|load failed/i.test(err.message) ? `${err.message} ` : "We could not reach the server. ",
        "Your answers are still here: try again, or call us",
        tel ? [" at ", el("a", { href: `tel:${tel}`, text: phone || tel })] : "", "."));
      banner.scrollIntoView?.({ block: "center", behavior: "smooth" });
      submit.disabled = false; submit.textContent = cfg.submit;
    }
  });
}

function thanks(host, type, fields, phone, tel) {
  const who = (fields.fullName || fields.name || "").split(" ")[0];
  const box = el("div", { class: "thanks", role: "status", tabindex: "-1" },
    el("h3", { text: who ? `Thank you, ${who}.` : "Thank you." }),
    el("p", { text: type === "event" ? "We received your event request." : "We received your quote request." }),
    el("p", { text: "This is a request, not a booking. Maruf Cafe will contact you to go over the details and the price. Nothing has been charged." }),
    el("p", { text: "If your date is soon, you can also call us." }),
    tel ? el("a", { class: "btn", href: `tel:${tel}`, text: `Call ${phone || tel}` }) : null,
    el("a", { class: "btn ghost", href: "/", text: "Back to the home page" }));
  host.replaceChildren(box);
  box.focus(); box.scrollIntoView({ block: "center", behavior: "smooth" });
}

document.querySelectorAll("[data-form]").forEach(mount);

// Fade-in on scroll (the home page does this in showcase.js).
const targets = [...document.querySelectorAll(".reveal:not(.in)")];
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
  targets.forEach((t) => io.observe(t));
} else targets.forEach((t) => t.classList.add("in"));
