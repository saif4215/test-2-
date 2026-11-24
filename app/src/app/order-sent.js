import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, H1, Small } from "../components/ui";
import { FormShell } from "../components/FormShell";
import { Celebrate } from "../components/Celebrate";
import { Cup } from "../components/Cup";
import { AnimatedFill } from "../components/Motion";
import { MapCard } from "../components/MapCard";
import { ImHere } from "../components/ImHere";
import { NotifyToggle } from "../components/NotifyToggle";
import { RateOrder } from "../components/RateOrder";
import { announceOrder } from "../lib/notify";
import { success } from "../lib/haptics";
import { money } from "../lib/order";
import { ORDER_STAGES, stageInfo } from "../lib/order-util";
import { cupLevel, cupMood } from "../lib/motion-util";
import { checkOrder } from "../lib/ordering";
import { useMemory } from "../lib/memory";
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
            <AnimatedFill pct={on ? 1 : 0} color={colors.gold} height={6} delay={i * 160} style={{ alignSelf: "stretch" }} />
            <Text style={{ fontSize: 13, fontWeight: on ? "800" : "600", color: on ? colors.ink : colors.muted }}>{s.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Shown after the café's server says the order is in Square. It then keeps asking how the order is doing until it is picked up or canceled. */
export default function OrderSent() {
  const { id, ref, total, name, preview, fresh, pickup, paid } = useLocalSearchParams();
  const { business } = useSite();
  const { active, activeStatus, setActiveStatus, awardPoints } = useMemory();
  const mine = active?.id === String(id);   // the order Home is following
  const [status, setStatus] = useState(mine ? activeStatus : "received");
  const [stale, setStale] = useState(false);   // the last check did not get through
  const wasPaid = !!paid || !!(mine && active?.paid);   // paid in the app: nothing to pay at the counter
  const info = stageInfo(status, wasPaid);
  // A little celebration when the order has just been sent (`fresh`), and again when it turns ready while you are looking. Not when you come back to an old one.
  const [party, setParty] = useState(0);
  useEffect(() => { if (id && fresh) { setParty(1); success(); } }, [id, fresh]);
  const before = useRef(status);
  useEffect(() => { if (before.current !== "ready" && status === "ready" && fresh) { setParty((n) => n + 1); success(); } before.current = status; }, [status, fresh]);

  useEffect(() => {
    if (!id) return undefined;
    let live = true, timer;
    const check = async () => {
      const r = await checkOrder(String(id));
      if (!live) return;
      if (r.ok) { announceOrder(String(id), ref, before.current, r.status); setStatus(r.status); if (mine) setActiveStatus(r.status); if (r.status === "done" && r.points > 0) awardPoints(String(id), r.points); }
      setStale(!r.ok);
      if (!(r.ok && stageInfo(r.status).final)) timer = setTimeout(check, CHECK_EVERY_MS);
    };
    timer = setTimeout(check, FIRST_CHECK_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [id, mine, setActiveStatus, awardPoints]);

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
      <Celebrate play={party} />
      <View style={{ alignItems: "flex-start", gap: 14, paddingTop: 18 }}>
        {canceled ? (
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={46} color={colors.danger} />
          </View>
        ) : (
          <View accessible={false} style={{ alignSelf: "stretch", alignItems: "center", paddingVertical: 14, borderRadius: 24, backgroundColor: info.status === "ready" || info.status === "done" ? colors.successSoft : colors.goldSoft }}>
            <Cup level={cupLevel(info.status)} size={132} tint="#7A4A2A" bounceKey={info.status} {...cupMood(info.status)} />
          </View>
        )}
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
      {!info.final && !canceled && !stale ? <ImHere id={String(id)} /> : null}
      {!info.final && !canceled ? <NotifyToggle /> : null}
      {info.status === "done" ? <RateOrder id={String(id)} /> : null}
      <Small>{stale ? "We can't check on your order right now. It was still sent. " : ""}{info.final ? "" : "This updates when Maruf Cafe updates your order. "}{wasPaid ? "You paid in the app: there is nothing to pay at the counter." : "Pay at the counter when you pick it up."}</Small>
      <Small>{pickup ? `Pickup at ${pickup} today: ` : "Pickup at "}{business.name}, {business.address.join(", ")}.</Small>
      <View style={{ gap: 12 }}>
        <Button title="Done" variant="primary" onPress={done} />
        <MapCard compact />
        <Button title="Call us" variant="outline" icon="call-outline" onPress={() => openLink(`tel:${business.phoneTel}`)} />
      </View>
    </FormShell>
  );
}
