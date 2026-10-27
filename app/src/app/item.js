import { useMemo } from "react";
import { Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, H1, Small } from "../components/ui";
import { Adder, ItemPhoto } from "../components/MenuBrowser";
import { money, priceText, useOrder } from "../lib/order";
import { useSite } from "../lib/site";
import { indexMenu } from "../lib/site-merge";
import { colors, fonts, radius } from "../theme";

/** One menu item, bigger: its picture, price and description, and the buttons to add it. Opened by tapping an item on the menu. */
export default function ItemDetails() {
  const { id } = useLocalSearchParams();
  const { menu, business } = useSite();
  const order = useOrder();
  const { width } = useWindowDimensions();
  const item = useMemo(() => indexMenu(menu).get(String(id)), [menu, id]);
  const side = Math.min(width - 40, 520);
  if (!item || item.hidden) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, gap: 14 }}>
        <Stack.Screen options={{ title: "Details" }} />
        <H1>That item isn't on the menu</H1>
        <Body>The café may have changed its menu. Go back to see what's available.</Body>
        <Button title="Back to the menu" variant="primary" onPress={() => router.back()} />
      </View>
    );
  }
  const qty = order.lines[item.id] || 0;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: item.name }} />
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 150 }}>
        <View style={{ width: "100%", maxWidth: 560, paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
          <ItemPhoto item={item} size={side} always box={{ borderRadius: radius.hero, alignSelf: "center" }} />
          <View style={{ gap: 6 }}>
            {item.cat ? <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.goldText }}>{item.cat}</Text> : null}
            <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.ink }}>{item.name}</Text>
            <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 22 }}>{priceText(item)}</Text>
          </View>
          {item.desc ? <Body>{item.desc}</Body> : null}
          {item.cents == null ? <Small>This item comes in more than one size, so the price depends on the size you choose. Maruf Cafe confirms it with you.</Small> : null}
          <View style={{ gap: 10, backgroundColor: colors.tint, borderRadius: 20, padding: 16 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Ionicons name="information-circle-outline" size={22} color={colors.goldText} />
              <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: colors.ink }}>Prices are before tax. For ingredients or allergies, please ask Maruf Cafe before you order.{item.image ? "" : " The picture is an illustration, not a photo of the dish."}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 32 }}>
              <Ionicons name="call-outline" size={18} color={colors.goldText} /><Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 15 }}>{business.phone}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", backgroundColor: colors.surface, paddingTop: 14, paddingBottom: 26, paddingHorizontal: 20, boxShadow: "0px -8px 24px rgba(36,26,18,0.08)" }}>
        <View style={{ width: "100%", maxWidth: 560, flexDirection: "row", alignItems: "center", gap: 14 }}>
          {qty ? (
            <>
              <Adder item={item} />
              <View style={{ flex: 1 }}><Button title={`View my order · ${order.exact ? money(order.low) : `from ${money(order.low)}`}`} variant="primary" icon="bag-handle-outline" onPress={() => router.replace("/order")} /></View>
            </>
          ) : (
            <View style={{ flex: 1 }}><Button title={`Add to order · ${item.cents != null ? money(item.cents) : `from ${money(item.min)}`}`} variant="gold" icon="add" accessibilityLabel={`Add ${item.name} to order`} onPress={() => order.change(item.id, +1)} /></View>
          )}
        </View>
      </View>
    </View>
  );
}
