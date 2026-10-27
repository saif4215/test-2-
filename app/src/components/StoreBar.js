import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSite } from "../lib/site";
import { openStatus } from "../lib/dates";
import { colors, radius, shadow } from "../theme";

/** "Pickup at Maruf Cafe": where the food comes from and whether the café is open. Tap it for the address, hours and directions. */
export function StoreBar({ style }) {
  const { business } = useSite();
  const status = openStatus(business.hours);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Pickup at ${business.name}, ${business.address.join(", ")}. ${status.text}. Open Contact for hours and directions.`} onPress={() => router.push("/contact")}
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
