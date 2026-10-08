// Tells the café owner about a new request: an email (through Resend) and/or a webhook (Slack, Zapier, Make).
// API keys stay in the server's environment and are never sent to browsers.
import { display } from "./forms.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function summarize(rec, labels) {
  return `${rec.title}\n` + Object.entries(rec.fields).map(([k, v]) => `${labels[k] || k}: ${display(k, v)}`).join("\n");
}

export function emailContent(rec, labels, adminUrl) {
  const f = rec.fields, who = f.fullName || f.name || "Someone";
  const size = f.people ? `${f.people} people` : f.guests ? `${f.guests} guests` : "";
  const when = f.dateNeeded || f.eventDate;
  const subject = `New ${rec.type === "event" ? "event rental request" : "large order request"}: ${who}${size ? `, ${size}` : ""}${when ? `, ${display("dateNeeded", when)}` : ""}`.slice(0, 200);
  const rows = Object.entries(f).map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#675E55;vertical-align:top;white-space:nowrap">${esc(labels[k] || k)}</td><td style="padding:6px 0;color:#1B1511;white-space:pre-wrap">${esc(display(k, v))}</td></tr>`).join("");
  const html = `<div style="font:16px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1B1511"><h2 style="margin:0 0 4px">${esc(rec.title)}</h2><p style="margin:0 0 16px;color:#675E55">Received ${esc(new Date(rec.receivedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }))} (New York time)</p><table style="border-collapse:collapse">${rows}</table>${adminUrl ? `<p style="margin-top:20px"><a href="${esc(adminUrl)}">Open the dashboard</a> to update the status.</p>` : ""}<p style="color:#675E55;font-size:14px">Reply to this email to answer ${esc(who)} directly.</p></div>`;
  const text = `${summarize(rec, labels)}\n\n${adminUrl ? `Dashboard: ${adminUrl}\n` : ""}Reply to this email to answer ${who} directly.`;
  return { subject, html, text };
}

/** Returns "sent" | "partial" | "failed" | "not_configured" and logs (without secrets) what went wrong. */
export async function notifyOwner(env, rec, labels) {
  const jobs = [];
  const adminUrl = env.PUBLIC_URL ? `${env.PUBLIC_URL.replace(/\/$/, "")}/admin/` : "";
  if (env.INQUIRY_WEBHOOK_URL) {
    const text = summarize(rec, labels);
    jobs.push(["webhook", fetch(env.INQUIRY_WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ text, content: text, id: rec.id, type: rec.type, receivedAt: rec.receivedAt, fields: rec.fields }),
    }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })]);
  }
  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    const mail = emailContent(rec, labels, adminUrl);
    jobs.push(["email", fetch(env.RESEND_API_BASE || "https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.NOTIFY_FROM || "Maruf Cafe <onboarding@resend.dev>", to: env.NOTIFY_EMAIL.split(",").map((s) => s.trim()).filter(Boolean), subject: mail.subject, html: mail.html, text: mail.text, ...(rec.fields.email ? { reply_to: rec.fields.email } : {}) }),
    }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })]);
  }
  if (!jobs.length) return "not_configured";
  const results = await Promise.allSettled(jobs.map(([, p]) => p));
  results.forEach((r, i) => { if (r.status === "rejected") console.error(`Notification (${jobs[i][0]}) failed: ${r.reason?.message}`); });
  const ok = results.filter((r) => r.status === "fulfilled").length;
  return ok === jobs.length ? "sent" : ok ? "partial" : "failed";
}
