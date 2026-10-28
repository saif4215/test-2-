import { useMemo } from "react";
import { ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Body, Button, Disclosure, H1, Small } from "../components/ui";
import { Adder, FavoriteButton, ItemPhoto } from "../components/MenuBrowser";
import { Customizer } from "../components/Customizer";
import { money, priceText, useOrder } from "../lib/order";
import { useSite } from "../lib/site";
import { indexMenu } from "../lib/site-merge";
import { colors, fonts, radius } from "../theme";
import { openLink } from "../lib/links";

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
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 170 }}>
        <View style={{ width: "100%", maxWidth: 560, paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
          <ItemPhoto item={item} size={side} always box={{ borderRadius: radius.hero, alignSelf: "center" }} />
          <View style={{ gap: 6 }}>
            <View style={{ position: "absolute", right: 0, top: 0, zIndex: 2 }}><FavoriteButton item={item} size={44} /></View>
            {item.cat ? <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.goldText }}>{item.cat}</Text> : null}
            <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.ink }}>{item.name}</Text>
            <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 22 }}>{priceText(item)}</Text>
          </View>
          {item.desc ? <Body>{item.desc}</Body> : null}
          {item.cents == null ? <Small>This item comes in more than one size, so the price depends on the size you choose. Maruf Cafe confirms it with you.</Small> : null}
          <Customizer item={item} />
          <Disclosure icon="create-outline" title="Add a note" hint={order.notes[item.id] || "Optional, for example: no onions"} defaultOpen={!!order.notes[item.id]}>
            <TextInput value={order.notes[item.id] || ""} onChangeText={(t) => order.setNote(item.id, t)} placeholder="For example: no onions" placeholderTextColor="#9A9087" accessibilityLabel="Note for Maruf Cafe" maxLength={100}
              style={{ backgroundColor: colors.bg, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 13, minHeight: 50, fontSize: 16, color: colors.ink, outlineStyle: "none" }} />
            <Small>Sent with your quote request. It is a request, not a promise: Maruf Cafe confirms what's possible.</Small>
          </Disclosure>
          <Small>
            Prices are before tax. For ingredients or allergies, please ask Maruf Cafe before you order:{" "}
            <Text accessibilityRole="button" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={() => openLink(`tel:${business.phoneTel}`)} style={{ fontWeight: "800", color: colors.goldText }}>{business.phone}</Text>.
            {item.image ? "" : " The picture is an illustration, not a photo of the dish."}
          </Small>
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
