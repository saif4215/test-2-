import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Field, Small } from "./ui";
import { money } from "../lib/order";
import { colors } from "../theme";

// Paying in the app. The card form, Apple Pay and Google Pay all come from Square (their script draws the card boxes inside this page).
// The card number never touches this app or the café's server: Square turns it into a one-time token, and the café's server uses that token to charge the order.
// This is the web app only. A phone-store build would need Square's in-app payments add-on.

let sdk = null;
function loadSquare(environment) {
  if (typeof window !== "undefined" && window.Square) return Promise.resolve(window.Square);
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = environment === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
    s.async = true;
    s.onload = () => (window.Square ? resolve(window.Square) : reject(new Error("Square did not start.")));
    s.onerror = () => { sdk = null; reject(new Error("Could not load the card form.")); };
    document.head.appendChild(s);
  });
  return sdk;
}

const asToken = (r) => (r && r.status === "OK" && r.token ? { ok: true, token: r.token } : { ok: false, error: (r && r.errors && r.errors[0] && r.errors[0].message) || "Please check your card details and try again." });

/**
 * The payment box at the bottom of My order. `onSubmit(tokenize)` is called when the customer taps Pay (or Apple Pay / Google Pay): the screen checks the pickup details,
 * then calls tokenize() for the one-time token and sends the order with it. totalCents is only what the buttons show: the café's server charges the exact total Square works out.
 */
export function PayForm({ payments, totalCents, disabled, busy, onSubmit }) {
  if (typeof window !== "undefined" && window.__MARUF_PREVIEW) return <DemoPay totalCents={totalCents} disabled={disabled} busy={busy} onSubmit={onSubmit} />;
  if (Platform.OS !== "web") {
    return (
      <View accessibilityRole="alert" style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: colors.goldSoft }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>Pay in your browser</Text>
        <Small>Paying for an order works in the Maruf Cafe web app. Please open it in your phone's browser to order.</Small>
      </View>
    );
  }
  return <SquarePay payments={payments} totalCents={totalCents} disabled={disabled} busy={busy} onSubmit={onSubmit} />;
}

function SquarePay({ payments, totalCents, disabled, busy, onSubmit }) {
  const [phase, setPhase] = useState("loading");   // loading, ready, failed
  const [wallets, setWallets] = useState({ apple: false, google: false });
  const sq = useRef(null), card = useRef(null), wallet = useRef({ apple: null, google: null });
  const latest = useRef({ disabled, busy, onSubmit });
  latest.current = { disabled, busy, onSubmit };   // the click handlers below read the newest values

  // the card boxes, once
  useEffect(() => {
    let live = true, made = null;
    (async () => {
      try {
        const Square = await loadSquare(payments.environment);
        sq.current = Square.payments(payments.applicationId, payments.locationId);
        made = await sq.current.card({ style: { input: { color: colors.ink, fontSize: "16px" }, "input::placeholder": { color: colors.placeholder }, ".input-container": { borderColor: colors.outline, borderRadius: "12px" }, ".input-container.is-focus": { borderColor: colors.gold }, ".message-text": { color: colors.muted } } });
        await made.attach("#maruf-card");
        if (!live) { try { made.destroy(); } catch { /* gone */ } return; }
        card.current = made; setPhase("ready");
      } catch { if (live) setPhase("failed"); }
    })();
    return () => { live = false; try { made && made.destroy && made.destroy(); } catch { /* gone */ } card.current = null; };
  }, [payments.applicationId, payments.locationId, payments.environment]);

  // Apple Pay and Google Pay, when this device can: drawn again when the total changes so the sheet shows the right amount
  useEffect(() => {
    if (phase !== "ready" || !sq.current) return undefined;
    let live = true, apple = null, google = null, onGoogle = null;
    const request = sq.current.paymentRequest({ countryCode: "US", currencyCode: "USD", total: { amount: (Math.max(0, totalCents) / 100).toFixed(2), label: "Maruf Cafe" } });
    const run = (w) => () => { const { disabled: d, busy: b, onSubmit: go } = latest.current; if (!d && !b) go(async () => asToken(await w.tokenize())); };
    (async () => {
      try {   // Apple Pay: only where the browser and the café's domain allow it (Safari, and the domain registered with Square)
        apple = await sq.current.applePay(request);
        const host = document.getElementById("maruf-apple");
        if (live && host) {
          host.replaceChildren();
          const b = document.createElement("button");
          b.type = "button"; b.setAttribute("aria-label", "Pay with Apple Pay");
          b.style.cssText = "-webkit-appearance:-apple-pay-button;appearance:-apple-pay-button;-apple-pay-button-type:pay;-apple-pay-button-style:black;width:100%;height:50px;border-radius:12px;cursor:pointer;border:0;";
          b.addEventListener("click", run(apple)); host.appendChild(b);
          wallet.current.apple = apple; setWallets((w) => ({ ...w, apple: true }));
        }
      } catch { /* not available here */ }
      try {   // Google Pay
        google = await sq.current.googlePay(request);
        if (live) {
          await google.attach("#maruf-gpay", { buttonColor: "black", buttonSizeMode: "fill" });
          const el = document.getElementById("maruf-gpay");
          onGoogle = run(google); if (el) el.addEventListener("click", onGoogle);
          wallet.current.google = google; setWallets((w) => ({ ...w, google: true }));
        }
      } catch { /* not available here */ }
    })();
    return () => {
      live = false;
      try { const el = document.getElementById("maruf-gpay"); if (el && onGoogle) el.removeEventListener("click", onGoogle); google && google.destroy && google.destroy(); } catch { /* gone */ }
      try { const h = document.getElementById("maruf-apple"); h && h.replaceChildren(); } catch { /* gone */ }
      wallet.current = { apple: null, google: null }; setWallets({ apple: false, google: false });
    };
  }, [phase, totalCents]);

  const payCard = () => onSubmit(async () => {
    if (!card.current) return { ok: false, error: "The card form is not ready yet. Please wait a moment." };
    try { return asToken(await card.current.tokenize()); } catch { return { ok: false, error: "We couldn't read your card. Please check it and try again." }; }
  });
  const any = wallets.apple || wallets.google;
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Pay now</Text>
      <View nativeID="maruf-apple" style={{ minHeight: wallets.apple ? 50 : 0 }} />
      <View nativeID="maruf-gpay" style={{ minHeight: wallets.google ? 50 : 0 }} />
      {any ? <Small style={{ textAlign: "center" }}>or pay with a card</Small> : null}
      <View accessible accessibilityLabel="Card details" nativeID="maruf-card" style={{ minHeight: phase === "ready" ? 0 : 96 }} />
      {phase === "loading" ? <Small>Loading the secure card form…</Small> : null}
      {phase === "failed" ? <Small style={{ color: colors.danger }}>We couldn't load the card form. Check your connection and reload this page, or call us.</Small> : null}
      <Button title={busy ? "Paying…" : `Pay ${money(totalCents)}`} variant="gold" icon="lock-closed-outline" disabled={disabled || busy || phase !== "ready"} accessibilityLabel={`Pay ${money(totalCents)} and place the order`} onPress={payCard} />
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
        <Small>Payments are handled by Square. Your card details never reach Maruf Cafe.</Small>
      </View>
    </View>
  );
}

/** The shared preview page has no real payments: a labelled stand-in so the layout can be seen. Nothing is charged and nothing is sent. */
function DemoPay({ totalCents, disabled, busy, onSubmit }) {
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Pay now</Text>
      <View accessibilityRole="alert" style={{ padding: 12, borderRadius: 14, backgroundColor: colors.goldSoft }}><Small style={{ color: colors.ink }}>This is a preview: the card form below is only a picture. The real app shows Square's secure card form, plus Apple Pay and Google Pay on phones that have them. Nothing is charged here.</Small></View>
      <Field label="Card number" value="4111 1111 1111 1111" editable={false} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Expires" value="12 / 30" editable={false} /></View>
        <View style={{ flex: 1 }}><Field label="Security code" value="123" editable={false} /></View>
        <View style={{ flex: 1 }}><Field label="ZIP" value="10309" editable={false} /></View>
      </View>
      <Button title={busy ? "Paying…" : `Pay ${money(totalCents)}`} variant="gold" icon="lock-closed-outline" disabled={disabled || busy} accessibilityLabel={`Pay ${money(totalCents)} and place the order`} onPress={() => onSubmit(async () => ({ ok: true, token: "cnon:card-nonce-demo" }))} />
      <Small style={{ textAlign: "center" }}>Payments are handled by Square. Your card details never reach Maruf Cafe.</Small>
    </View>
  );
}
