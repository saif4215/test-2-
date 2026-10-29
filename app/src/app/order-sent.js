import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, H1, Small } from "../components/ui";
import { FormShell } from "../components/FormShell";
import { money } from "../lib/order";
import { ORDER_STAGES, stageInfo } from "../lib/order-util";
import { checkOrder } from "../lib/ordering";
import { useSite } from "../lib/site";
import { openLink } from "../lib/links";
import { colors } from "../theme";

const FIRST_CHECK_MS = 5000, CHECK_EVERY_MS = 15000;

/** The three steps: sent, accepted, ready. The café moves them in Square. */
function Tracker({ step, canceled }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={canceled ? "Order canceled" : `Step ${step + 1} of ${ORDER_STAGES.length}: ${ORDER_STAGES[Math.max(0, step)].label}`} style={{ flexDirection: "row", gap: 8 }}>
      {ORDER_STAGES.map((s, i) => {
        const on = !canceled && i <= step;
        return (
          <View key={s.id} style={{ flex: 1, gap: 8, alignItems: "center" }}>
            <View style={{ height: 6, alignSelf: "stretch", borderRadius: 3, backgroundColor: on ? colors.gold : colors.line }} />
            <Text style={{ fontSize: 13, fontWeight: on ? "800" : "600", color: on ? colors.ink : colors.muted }}>{s.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Shown after the café's server says the order is in Square. It then keeps asking how the order is doing until it is picked up or canceled. */
export default function OrderSent() {
  const { id, ref, total, name, preview } = useLocalSearchParams();
  const { business } = useSite();
  const [status, setStatus] = useState("received");
  const [stale, setStale] = useState(false);   // the last check did not get through
  const info = stageInfo(status);

  useEffect(() => {
    if (!id) return undefined;
    let live = true, timer;
    const check = async () => {
      const r = await checkOrder(String(id));
      if (!live) return;
      if (r.ok) setStatus(r.status);
      setStale(!r.ok);
      if (!(r.ok && stageInfo(r.status).final)) timer = setTimeout(check, CHECK_EVERY_MS);
    };
    timer = setTimeout(check, FIRST_CHECK_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [id]);

  const done = () => (router.dismissAll ? router.dismissAll() : router.replace("/"));
  const canceled = info.status === "canceled";
  if (!id) {   // opened without an order (an old link, say): never say something was sent
    return (
      <FormShell>
        <Stack.Screen options={{ title: "Order sent" }} />
        <View style={{ alignItems: "flex-start", gap: 14, paddingTop: 18 }}>
          <H1>No order here</H1>
          <Body>Open the Menu to start an order.</Body>
          <Button title="Browse the menu" variant="gold" onPress={() => router.replace("/menu")} />
        </View>
      </FormShell>
    );
  }
  return (
    <FormShell>
      <Stack.Screen options={{ title: "Order sent" }} />
      <View style={{ alignItems: "flex-start", gap: 14, paddingTop: 18 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: canceled ? "#FBEAE8" : colors.successSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={canceled ? "close" : info.status === "ready" || info.status === "done" ? "bag-check" : "checkmark"} size={46} color={canceled ? colors.danger : colors.success} />
        </View>
        <H1>{info.title}</H1>
        <Body style={{ fontSize: 18, lineHeight: 27 }}>{name ? `Thank you, ${name}. ` : ""}{info.text}</Body>
      </View>
      {preview ? (
        <Card style={{ padding: 14, backgroundColor: colors.goldSoft }}><Small style={{ color: colors.ink }}>This is a preview, so nothing was sent to the café.</Small></Card>
      ) : null}
      {ref ? (
        <Card style={{ padding: 18, gap: 4, alignItems: "flex-start" }}>
          <Small style={{ fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", color: colors.goldText }}>Your order code</Small>
          <Text accessibilityLabel={`Order code ${String(ref).split("").join(" ")}`} style={{ fontSize: 40, fontWeight: "800", letterSpacing: 6, color: colors.ink }}>{ref}</Text>
          <Small>Say this at the counter if the café asks.{total ? ` Order total ${money(Number(total))}.` : ""}</Small>
        </Card>
      ) : null}
      <Tracker step={info.step} canceled={canceled} />
      <Small>{stale ? "We can't check on your order right now. It was still sent. " : ""}{info.final ? "" : "This updates when Maruf Cafe updates your order. "}Pay at the counter when you pick it up.</Small>
      <Small>Pickup at {business.name}, {business.address.join(", ")}.</Small>
      <View style={{ gap: 12 }}>
        <Button title="Done" variant="primary" onPress={done} />
        <Button title="Call us" variant="outline" icon="call-outline" onPress={() => openLink(`tel:${business.phoneTel}`)} />
      </View>
    </FormShell>
  );
}
