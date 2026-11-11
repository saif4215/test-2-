import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, ClosedNotice, Disclosure, Field, FormGroup, H1, Small } from "../components/ui";
import { FormShell, SendError } from "../components/FormShell";
import { Adder, BleedRow, ItemPhoto, ItemTile, RowHead } from "../components/MenuBrowser";
import { business } from "../config";   // only the Square Online address is used here
import { money, priceText, useOrder } from "../lib/order";
import { buildPickup, estimateTax, keyFor, orderBody, splitOrderable } from "../lib/order-util";
import { sendOrder, useOrderingConfig } from "../lib/ordering";
import { useSite } from "../lib/site";
import { suggestFor } from "../lib/site-merge";
import { useMemory } from "../lib/memory";
import { warn } from "../lib/haptics";
import { colors } from "../theme";
import { openLink } from "../lib/links";

export default function MyOrder() {
  const order = useOrder();
  const memory = useMemory();
  const { on: ordering, tax } = useOrderingConfig();   // ordering: true when the café's server can put an order into its Square; tax: the percentage it adds
  const { needsPrice } = splitOrderable(order.entries);
  const canPlace = ordering === true && needsPrice.length === 0;
  const incomplete = order.incomplete;   // a must-pick choice (hot or iced ...) is still missing on these lines
  const { menu } = useSite();
  const last = order.entries[order.entries.length - 1];
  const more = useMemo(() => (last ? suggestFor(menu, last, Object.keys(order.lines), 6) : []), [menu, last, order.lines]);   // "Add something else"
  const [asking, setAsking] = useState(false);   // "Clear my order" asks once more before throwing the order away
  const showTax = canPlace && tax > 0 && order.exact;
  const taxCents = estimateTax(order.low, tax);
  const sent = () => memory.rememberOrder(order.entries);   // so "Order again" can offer these items next time

  // Who is picking it up: on this same screen, so placing an order is one screen and one button.
  const { business: shop } = useSite();
  const [v, setV] = useState({ name: "", phone: "", note: "" });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: "" });
  const key = useRef(null);   // kept between tries, so a second tap after a bad connection can never make two orders
  useEffect(() => { setV((cur) => ({ ...cur, name: cur.name || memory.contact.name, phone: cur.phone || memory.contact.phone })); }, [memory.contact]);   // the name and phone used last time
  const set = (k) => (t) => {
    setV((cur) => ({ ...cur, [k]: t }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
    setState((st) => (st.error && !st.busy ? { ...st, error: "" } : st));   // the message was about what they have now changed
  };
  async function submit() {
    if (incomplete.length) { setState({ busy: false, error: `Choose ${incomplete[0].missing[0].label.toLowerCase()} for ${incomplete[0].name} first.` }); return; }
    const built = buildPickup(v);
    setErrors(built.errors);
    if (Object.keys(built.errors).length) { setState({ busy: false, error: "Please check the highlighted fields." }); return; }
    const body = orderBody(order.entries, order.notes, built.fields);
    key.current = keyFor(key.current, body);
    setState({ busy: true, error: "" });
    const res = await sendOrder({ ...body, idempotencyKey: key.current.key });
    if (!res.ok) { warn(); setState({ busy: false, error: res.error }); return; }
    memory.rememberContact(built.fields.name, v.phone.trim());   // as typed, so it looks the same next time
    memory.rememberOrder(order.entries);
    memory.rememberActive({ id: res.orderId, ref: res.ref, total: res.totalCents, name: built.fields.name, preview: res.preview });   // Home shows where it stands
    router.replace({ pathname: "/order-sent", params: { id: res.orderId, ref: res.ref, total: res.totalCents == null ? "" : String(res.totalCents), name: built.fields.name, fresh: "1", ...(res.preview ? { preview: "1" } : {}) } });
    order.clear();
  }
  return (
    <FormShell>
      <H1>My order</H1>
      {order.count === 0 ? (
        <View style={{ alignItems: "flex-start", gap: 14, paddingTop: 6 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="bag-handle-outline" size={38} color={colors.goldText} /></View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Nothing here yet</Text>
          <Body>Your order is empty. Add something from the menu.</Body>
          <Button title="Browse the menu" variant="gold" onPress={() => router.replace("/menu")} />
        </View>
      ) : (
        <>
          <View style={{ gap: 12 }}>
            {order.entries.map((l) => (
              <Card key={l.id} style={{ padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
                <ItemPhoto item={l} size={64} always box={{ borderRadius: 16 }} />
                <Pressable accessibilityRole="button" accessibilityLabel={`${l.name}: change options or add a note`} onPress={() => router.push({ pathname: "/item", params: { id: l.id } })} style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={2} style={{ fontWeight: "800", fontSize: 16, lineHeight: 21, color: colors.ink }}>{l.name}</Text>
                  <Small>{l.unit != null ? money(l.unit) : priceText(l)} each</Small>
                  {order.details[l.id] ? <Text style={{ fontSize: 13, lineHeight: 18, color: colors.goldText, fontWeight: "600" }}>{order.details[l.id]}</Text> : null}
                  {l.missing.length ? <Text style={{ fontSize: 13, lineHeight: 18, color: colors.danger, fontWeight: "800" }}>Choose {l.missing.map((m) => m.label.toLowerCase()).join(" and ")}</Text> : null}
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.goldText }}>Edit</Text>
                </Pressable>
                <Adder item={l} />
              </Card>
            ))}
          </View>
          {more.length ? (
            <View>
              <RowHead title="Add something else" />
              <BleedRow>{more.map((it) => <ItemTile key={`more-${it.id}`} item={it} width={132} />)}</BleedRow>
            </View>
          ) : null}
          <Card style={{ padding: 18, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, color: colors.muted }}>{order.count} {order.count === 1 ? "item" : "items"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>{order.exact ? "Subtotal" : "Subtotal (from)"}</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{money(order.low)}</Text>
            </View>
            {showTax ? (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 15, color: colors.muted }}>Estimated tax ({tax}%)</Text>
                  <Text style={{ fontSize: 15, color: colors.muted }}>{money(taxCents)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.line }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Estimated total</Text>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{money(order.low + taxCents)}</Text>
                </View>
              </>
            ) : null}
            {!order.exact ? <Small>Some items have more than one size. Your final price depends on the sizes you choose.</Small> : null}
            <Small>{showTax ? "The café works out the exact tax when it takes your order. " : "Menu prices before tax. "}For large orders, Maruf Cafe confirms your final quote with you.</Small>
          </Card>
          {ordering === true && needsPrice.length ? (
            <Card style={{ padding: 16, gap: 6 }}>
              <Text style={{ fontWeight: "800", fontSize: 15, color: colors.ink }}>Some items can't be sent from the app yet</Text>
              <Small>{needsPrice.map((l) => l.name).join(", ")} {needsPrice.length === 1 ? "has" : "have"} more than one price, depending on the size. Remove {needsPrice.length === 1 ? "it" : "them"} to place your order here, or order at the counter, on Square Online, or send a quote request.</Small>
            </Card>
          ) : null}
          {canPlace ? (
            <FormGroup title="Pickup">
              <Card style={{ padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Ionicons name="storefront-outline" size={22} color={colors.goldText} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Text style={{ fontWeight: "800", color: colors.ink }}>Pick up at {shop.name}</Text>
                  <Small>{shop.address.join(", ")}</Small>
                  <Small>You pay at the counter when you pick it up.</Small>
                </View>
              </Card>
              <Field label="Name" required value={v.name} onChangeText={set("name")} error={errors.name} autoComplete="name" textContentType="name" maxLength={60} />
              <Field label="Phone Number" required value={v.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" hint="So the café can reach you about your order." />
              <Disclosure title="Add a note for the café" hint="Optional, for example: I will be there at 5:30" defaultOpen={!!v.note}>
                <Field label="Anything the café should know?" multiline value={v.note} onChangeText={set("note")} maxLength={200} placeholder="Optional" />
              </Disclosure>
            </FormGroup>
          ) : null}
          <View style={{ gap: 12 }}>
            {canPlace ? (
              <>
                <ClosedNotice />
                <SendError message={state.error} />
                <Button title={state.busy ? "Sending…" : incomplete.length ? `Choose ${incomplete[0].missing[0].label.toLowerCase()} first` : "Place order for pickup"} variant="gold" icon="bag-check-outline" disabled={state.busy || incomplete.length > 0} onPress={submit} />
                <Small style={{ textAlign: "center" }}>Placing an order sends it to Maruf Cafe. It is not confirmed until the café accepts it. You pay at the counter.</Small>
                <Disclosure title="Other ways to order" hint="A quote for a big order, or our Square Online store">
                  <Button title="Request a quote with these items" variant="outline" size="medium" onPress={() => { sent(); router.replace({ pathname: "/quote", params: { foodItems: order.summary } }); }} />
                  <Button title="Order pickup on Square Online" variant="outline" size="medium" icon="open-outline" href={business.orderUrl} onPress={sent} />
                </Disclosure>
              </>
            ) : (
              <>
                <Button title="Request a quote with these items" variant="gold" onPress={() => { sent(); router.replace({ pathname: "/quote", params: { foodItems: order.summary } }); }} />
                <Button title="Order pickup on Square Online" variant="primary" icon="open-outline" href={business.orderUrl} onPress={sent} />
              </>
            )}
            {asking ? (
              <Card style={{ padding: 14, gap: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink }}>Remove everything from your order?</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}><Button title="Keep it" variant="outline" size="medium" onPress={() => setAsking(false)} /></View>
                  <View style={{ flex: 1 }}><Button title="Yes, clear it" variant="primary" size="medium" onPress={() => { setAsking(false); order.clear(); }} /></View>
                </View>
              </Card>
            ) : <Button title="Clear my order" variant="outline" size="medium" onPress={() => setAsking(true)} />}
          </View>
        </>
      )}
    </FormShell>
  );
}
