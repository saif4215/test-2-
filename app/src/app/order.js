import { Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, H1, Small } from "../components/ui";
import { FormShell } from "../components/FormShell";
import { Adder, ItemPhoto } from "../components/MenuBrowser";
import { business } from "../config";   // only the Square Online address is used here
import { money, priceText, useOrder } from "../lib/order";
import { colors } from "../theme";

export default function MyOrder() {
  const order = useOrder();
  return (
    <FormShell>
      <H1>My order</H1>
      {order.count === 0 ? (
        <View style={{ alignItems: "flex-start", gap: 14, paddingTop: 6 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="bag-handle-outline" size={38} color={colors.goldText} /></View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Nothing here yet</Text>
          <Body>Your order is empty. Add something from the menu.</Body>
          <Button title="Browse the menu" variant="gold" onPress={() => router.replace("/menu")} />
        </View>
      ) : (
        <>
          <View style={{ gap: 12 }}>
            {order.entries.map((l) => (
              <Card key={l.id} style={{ padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
                <ItemPhoto item={l} size={64} always box={{ borderRadius: 16 }} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={2} style={{ fontWeight: "800", fontSize: 16, lineHeight: 21, color: colors.ink }}>{l.name}</Text>
                  <Small>{priceText(l)} each</Small>
                </View>
                <Adder item={l} />
              </Card>
            ))}
          </View>
          <Card style={{ padding: 18, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, color: colors.muted }}>{order.count} {order.count === 1 ? "item" : "items"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>{order.exact ? "Subtotal" : "Subtotal (from)"}</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{money(order.low)}</Text>
            </View>
            {!order.exact ? <Small>Some items have more than one size. Your final price depends on the sizes you choose.</Small> : null}
            <Small>Menu prices before tax. For large orders, Maruf Cafe confirms your final quote with you.</Small>
          </Card>
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
