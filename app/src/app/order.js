import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, H1, Small } from "../components/ui";
import { FormShell } from "../components/FormShell";
import { business } from "../config";
import { money, priceText, useOrder } from "../lib/order";
import { colors } from "../theme";

export default function MyOrder() {
  const order = useOrder();
  return (
    <FormShell>
      <H1>My order</H1>
      {order.count === 0 ? (
        <Body>Your order is empty. Add something from the menu.</Body>
      ) : (
        <>
          <View style={{ gap: 12 }}>
            {order.entries.map((l) => (
              <Card key={l.id} style={{ padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontWeight: "800", fontSize: 16, color: colors.ink }}>{l.name}</Text>
                  <Small>{priceText(l)} each</Small>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${l.name}`} onPress={() => order.change(l.id, -1)} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}><Ionicons name="remove" size={18} color={colors.ink} /></Pressable>
                <Text style={{ minWidth: 22, textAlign: "center", fontWeight: "800", color: colors.ink }}>{l.qty}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Add one more ${l.name}`} onPress={() => order.change(l.id, +1)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={18} color={colors.cream} /></Pressable>
              </Card>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>{order.exact ? "Subtotal" : "Subtotal (from)"}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>{money(order.low)}</Text>
          </View>
          {!order.exact ? <Small>Some items have more than one size. Your final price depends on the sizes you choose.</Small> : null}
          <Small>Menu prices before tax. For large orders, Maruf Cafe confirms your final quote with you.</Small>
          <View style={{ gap: 12 }}>
            <Button title="Request a quote with these items" variant="gold" onPress={() => router.replace({ pathname: "/quote", params: { foodItems: order.summary } })} />
            <Button title="Order pickup on Square Online" variant="primary" icon="open-outline" onPress={() => Linking.openURL(business.orderUrl)} />
            <Button title="Clear my order" variant="outline" size="medium" onPress={order.clear} />
          </View>
        </>
      )}
    </FormShell>
  );
}
