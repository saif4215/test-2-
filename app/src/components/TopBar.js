import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrder } from "../lib/order";
import { colors } from "../theme";

/** Pickup / Delivery switch. It sets the default on the quote forms. */
export function ModeToggle() {
  const { mode, setMode } = useOrder();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", backgroundColor: colors.tint, borderRadius: 999, padding: 4 }}>
      {[["pickup", "Pickup"], ["delivery", "Delivery"]].map(([value, label]) => {
        const on = mode === value;
        return (
          <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setMode(value)}
            style={{ paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: on ? "#FFFFFF" : "transparent", boxShadow: on ? "0 1px 4px rgba(0,0,0,0.18)" : undefined, minHeight: 36, justifyContent: "center" }}>
            <Text style={{ fontWeight: "800", fontSize: 14, color: on ? colors.ink : colors.muted }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BasketButton() {
  const { count } = useOrder();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count ? `Basket, ${count} items` : "Basket"} onPress={() => router.navigate("/basket")}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="bag-handle-outline" size={22} color={colors.ink} />
      {count ? (
        <View style={{ position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Top row used on every tab: mode toggle on the left, basket on the right. */
export function TopBar({ title }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      {title ? <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 }}>{title}</Text> : <ModeToggle />}
      <BasketButton />
    </View>
  );
}
