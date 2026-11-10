import { useEffect } from "react";
import { Pressable, Text, Vibration, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMemory } from "../lib/memory";
import { ORDER_STAGES, stageInfo } from "../lib/order-util";
import { checkOrder } from "../lib/ordering";
import { success } from "../lib/haptics";
import { colors, radius, shadow } from "../theme";

const WATCH_MS = 20000, SLOWEST_MS = 120000;

/**
 * Keeps asking the café how the order just placed is doing, until it is picked up or canceled, and tells the rest of the app
 * (the card on Home and Menu). Draws nothing itself. When the connection is bad it asks less often instead of more.
 */
export function OrderWatcher() {
  const { active, setActiveStatus } = useMemory();
  const id = active?.id;
  useEffect(() => {
    if (!id) return undefined;
    let live = true, timer, failures = 0, last = null;
    const check = async () => {
      const r = await checkOrder(id);
      if (!live) return;
      if (r.ok) {
        failures = 0; setActiveStatus(r.status);
        if (r.status === "ready" && last && last !== "ready") { success(); try { Vibration.vibrate([0, 300, 150, 300]); } catch { /* no vibration here */ } }   // a nudge when it turns ready while the app is open
        last = r.status;
        if (stageInfo(r.status).final) return;
      } else failures += 1;
      timer = setTimeout(check, Math.min(SLOWEST_MS, WATCH_MS * 2 ** Math.min(failures, 3)));
    };
    check();
    return () => { live = false; clearTimeout(timer); };
  }, [id, setActiveStatus]);
  return null;
}

/** The three steps as a thin bar. */
function Steps({ step, canceled }) {
  return (
    <View accessible={false} style={{ flexDirection: "row", gap: 5 }}>
      {ORDER_STAGES.map((s, i) => <View key={s.id} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: !canceled && i <= step ? colors.gold : colors.line }} />)}
    </View>
  );
}

/**
 * Where the order just placed stands, as a card that opens the full order screen. Shown on Home and above the Menu until the customer
 * closes it (possible once the order is picked up or canceled). Nothing shows when no order was placed in the last 12 hours.
 */
export function ActiveOrderCard({ compact, style }) {
  const { active, activeStatus, forgetActive } = useMemory();
  if (!active) return null;
  const info = stageInfo(activeStatus), canceled = info.status === "canceled", ready = info.status === "ready", finished = info.final;
  const open = () => router.push({ pathname: "/order-sent", params: { id: active.id, ref: active.ref, total: active.total == null ? "" : String(active.total), name: active.name, ...(active.preview ? { preview: "1" } : {}) } });
  const tone = canceled ? { bg: "#FBEAE8", fg: colors.danger, icon: "close" } : ready || info.status === "done" ? { bg: colors.successSoft, fg: colors.success, icon: "bag-check" } : { bg: colors.goldSoft, fg: colors.goldText, icon: "receipt-outline" };
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Your order${active.ref ? ` ${active.ref}` : ""}: ${info.title}. See details`} onPress={open}
        style={({ pressed }) => [{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: compact ? 18 : radius.card, borderWidth: 1, borderColor: ready ? colors.success : "rgba(36,26,18,0.06)", padding: compact ? 10 : 14, opacity: pressed ? 0.92 : 1 }, shadow]}>
        <View style={{ width: compact ? 38 : 46, height: compact ? 38 : 46, borderRadius: 23, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}><Ionicons name={tone.icon} size={compact ? 19 : 23} color={tone.fg} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: compact ? 0 : 6 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", color: colors.goldText }}>Your order{active.ref ? ` · ${active.ref}` : ""}</Text>
          <Text numberOfLines={1} style={{ fontSize: compact ? 15 : 17, fontWeight: "800", color: colors.ink }}>{info.title}</Text>
          {compact ? null : <Steps step={info.step} canceled={canceled} />}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      {finished ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Close order card" onPress={forgetActive} hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name="close" size={20} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}
