import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSite } from "../lib/site";
import { openStatus } from "../lib/dates";
import { colors, radius, shadow } from "../theme";

/**
 * "Pickup at Maruf Cafe": where the food comes from and whether the café is open. Tap it for the address, hours and directions.
 * `compact` is one quiet line (for under a screen's title); otherwise it is a card.
 */
export function StoreBar({ style, compact }) {
  const { business } = useSite();
  const status = openStatus(business.hours);
  const label = `Pickup at ${business.name}, ${business.address.join(", ")}. ${status.text}. Open Contact for hours and directions.`;
  if (compact) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push("/contact")} hitSlop={6} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 }, style]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.open ? "#2E9E68" : "#A99C8C" }} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: "600", color: colors.muted }}>{status.text.replace(/^Open now/, "Open")}  ·  {business.address[0]}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push("/contact")}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: "rgba(36,26,18,0.06)", paddingVertical: 12, paddingHorizontal: 14, opacity: pressed ? 0.92 : 1 }, shadow, style]}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="storefront-outline" size={21} color={colors.goldText} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", color: colors.goldText }}>Pickup at {business.name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>{business.address.join(", ")}</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: status.open ? colors.success : colors.muted }}>{status.text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
