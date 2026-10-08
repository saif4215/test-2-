import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TopBar } from "../../components/TopBar";
import { Button } from "../../components/ui";
import { business } from "../../config";
import { money, priceText, useOrder } from "../../lib/order";
import { colors } from "../../theme";

const WRAP = { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16 };

export default function Basket() {
  const order = useOrder();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Basket" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {order.count === 0 ? (
          <View style={[WRAP, { alignItems: "center", gap: 14, paddingTop: 80 }]}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}><Ionicons name="bag-handle-outline" size={44} color={colors.ink} /></View>
            <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "800", color: colors.ink }}>Your basket is empty</Text>
            <Text style={{ fontSize: 16, color: colors.muted, textAlign: "center" }}>Add items from the menu, then send them as a quote request or order for pickup.</Text>
            <Button title="Browse the menu" variant="primary" onPress={() => router.navigate("/menu")} style={{ alignSelf: "stretch", marginTop: 8 }} />
          </View>
        ) : (
          <View style={[WRAP, { gap: 16, paddingTop: 4 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View><Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>Maruf Cafe</Text><Text style={{ fontSize: 14, color: colors.muted }}>{order.mode === "delivery" ? "Delivery (confirmed with you)" : "Pickup"} · {business.address[0]}</Text></View>
            </View>
            <View>
              {order.entries.map((l) => (
                <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.tint, borderRadius: 999, height: 40 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${l.name}`} onPress={() => order.change(l.id, -1)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Ionicons name={l.qty === 1 ? "trash-outline" : "remove"} size={18} color={colors.ink} /></Pressable>
                    <Text style={{ minWidth: 20, textAlign: "center", fontWeight: "800", color: colors.ink }}>{l.qty}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Add one more ${l.name}`} onPress={() => order.change(l.id, +1)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={18} color={colors.ink} /></Pressable>
                  </View>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink }}>{l.name}</Text>
                  <Text style={{ fontSize: 15, color: colors.ink }}>{l.cents != null ? money(l.cents * l.qty) : `from ${money(l.min * l.qty)}`}</Text>
                </View>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.navigate("/menu")} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="add-circle-outline" size={20} color={colors.ink} /><Text style={{ fontWeight: "800", color: colors.ink }}>Add items</Text>
            </Pressable>
            <View style={{ gap: 8, backgroundColor: colors.tint, borderRadius: 14, padding: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>{order.exact ? "Subtotal" : "Subtotal (from)"}</Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>{money(order.low)}</Text>
              </View>
              {!order.exact ? <Text style={{ fontSize: 13, color: colors.muted }}>Some items have more than one size. The final price depends on the sizes you choose.</Text> : null}
              <Text style={{ fontSize: 13, color: colors.muted }}>Menu prices before tax. For large orders, Maruf Cafe confirms your final quote with you.</Text>
            </View>
            <View style={{ gap: 12 }}>
              <Button title="Request a quote with these items" variant="primary" onPress={() => router.push({ pathname: "/quote", params: { foodItems: order.summary } })} />
              {order.mode === "pickup" ? <Button title="Order pickup on Square Online" variant="light" icon="open-outline" onPress={() => Linking.openURL(business.orderUrl)} /> : null}
              <Button title="Clear basket" variant="outline" size="medium" onPress={order.clear} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
