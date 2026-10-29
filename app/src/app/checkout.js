import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Field, FormGroup, H1, Small } from "../components/ui";
import { FormShell, SendError } from "../components/FormShell";
import { money, priceText, useOrder } from "../lib/order";
import { buildPickup, keyFor, orderBody, splitOrderable } from "../lib/order-util";
import { sendOrder, useOrdering } from "../lib/ordering";
import { useMemory } from "../lib/memory";
import { useSite } from "../lib/site";
import { colors } from "../theme";

/** Pickup details: who the order is for. Placing it sends it to the café's Square; nothing is paid in the app. */
export default function Checkout() {
  const order = useOrder();
  const memory = useMemory();
  const ordering = useOrdering();
  const { business } = useSite();
  const { needsPrice } = splitOrderable(order.entries);
  const [v, setV] = useState({ name: "", phone: "", note: "" });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: "" });
  const key = useRef(null);   // kept between tries, so a second tap after a bad connection can never make two orders
  // The name and phone used last time come back once the phone has read them.
  useEffect(() => { setV((cur) => ({ ...cur, name: cur.name || memory.contact.name, phone: cur.phone || memory.contact.phone })); }, [memory.contact]);
  const set = (k) => (t) => {
    setV((cur) => ({ ...cur, [k]: t }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
    setState((st) => (st.error && !st.busy ? { ...st, error: "" } : st));   // the message was about what they have now changed
  };

  async function submit() {
    const built = buildPickup(v);
    setErrors(built.errors);
    if (Object.keys(built.errors).length) { setState({ busy: false, error: "Please check the highlighted fields." }); return; }
    const body = orderBody(order.entries, order.details, built.fields);
    key.current = keyFor(key.current, body);
    setState({ busy: true, error: "" });
    const res = await sendOrder({ ...body, idempotencyKey: key.current.key });
    if (!res.ok) { setState({ busy: false, error: res.error }); return; }
    memory.rememberContact(built.fields.name, v.phone.trim());   // as typed, so it looks the same next time
    memory.rememberOrder(order.entries);
    router.replace({ pathname: "/order-sent", params: { id: res.orderId, ref: res.ref, total: res.totalCents == null ? "" : String(res.totalCents), name: built.fields.name, ...(res.preview ? { preview: "1" } : {}) } });
    order.clear();
  }

  const unavailable = order.count === 0 || ordering === false || needsPrice.length > 0;
  return (
    <FormShell>
      <Stack.Screen options={{ title: "Pickup order" }} />
      {ordering === null && order.count > 0 ? <Body>One moment…</Body> : unavailable ? (
        <View style={{ alignItems: "flex-start", gap: 14, paddingTop: 6 }}>
          <H1>{order.count === 0 ? "Your order is empty" : "This order can't be placed here"}</H1>
          <Body>{order.count === 0 ? "Add something from the menu first." : ordering === false ? "Ordering from the app isn't available right now. You can still order on Square Online or call us." : "Some items have more than one price. Take them out of your order, or order at the counter."}</Body>
          <Button title="Back to my order" variant="gold" onPress={() => router.replace(order.count === 0 ? "/menu" : "/order")} />
        </View>
      ) : (
        <>
          <H1>Pickup order</H1>
          <Card style={{ padding: 16, gap: 10 }}>
            {order.entries.map((l) => (
              <View key={l.id} style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.ink }}>{l.qty} × {l.name}</Text>
                  <Text style={{ fontSize: 15.5, color: colors.ink }}>{money(l.cents * l.qty)}</Text>
                </View>
                {order.details[l.id] ? <Small>{order.details[l.id]}</Small> : null}
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.line }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.ink }}>Subtotal</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{money(order.low)}</Text>
            </View>
            <Small>Menu prices before tax.</Small>
          </Card>
          <Card style={{ padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Ionicons name="storefront-outline" size={22} color={colors.goldText} />
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={{ fontWeight: "800", color: colors.ink }}>Pick up at {business.name}</Text>
              <Small>{business.address.join(", ")}</Small>
              <Small>You pay at the counter when you pick it up.</Small>
            </View>
          </Card>
          <FormGroup title="Who is picking it up?">
            <Field label="Name" required value={v.name} onChangeText={set("name")} error={errors.name} autoComplete="name" textContentType="name" maxLength={60} />
            <Field label="Phone Number" required value={v.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" hint="So the café can reach you about your order." />
            <Field label="Anything the café should know?" multiline value={v.note} onChangeText={set("note")} maxLength={200} placeholder="Optional" />
          </FormGroup>
          <SendError message={state.error} />
          <Button title={state.busy ? "Sending…" : "Place order"} variant="gold" icon="bag-check-outline" disabled={state.busy} onPress={submit} />
          <Small style={{ textAlign: "center" }}>Placing an order sends it to Maruf Cafe. It is not confirmed until the café accepts it.</Small>
        </>
      )}
    </FormShell>
  );
}
