import { View } from "react-native";
import { router } from "expo-router";
import { Button } from "./ui";
import { money, useOrder } from "../lib/order";

/** Floating "View basket" bar shown above the tab bar whenever the basket has something in it. */
export function BasketBar() {
  const order = useOrder();
  if (!order.count) return null;
  return (
    <View style={{ position: "absolute", left: 16, right: 16, bottom: 12, alignItems: "center", pointerEvents: "box-none" }}>
      <View style={{ width: "100%", maxWidth: 560 }}>
        <Button title={`View basket · ${order.count} ${order.count === 1 ? "item" : "items"} · ${order.exact ? money(order.low) : `from ${money(order.low)}`}`} variant="primary" onPress={() => router.navigate("/basket")} />
      </View>
    </View>
  );
}
