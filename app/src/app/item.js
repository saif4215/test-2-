import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Body, Button, Disclosure, H1, Small } from "../components/ui";
import { Ionicons } from "@expo/vector-icons";
import { BleedRow, FavoriteButton, ItemPhoto, ItemTile, RowHead } from "../components/MenuBrowser";
import { Customizer } from "../components/Customizer";
import { money, priceText, useOrder } from "../lib/order";
import { unitCents } from "../lib/customize";
import { useSite } from "../lib/site";
import { select, success } from "../lib/haptics";
import { MAX_QTY } from "../lib/memory-util";
import { useOrdering } from "../lib/ordering";
import { indexMenu, suggestFor } from "../lib/site-merge";
import { colors, fonts, radius } from "../theme";
import { openLink } from "../lib/links";

/** [ - 2 + ] for choosing how many before adding. */
function QtyStepper({ qty, min, onChange, name }) {
  const btn = (disabled) => ({ width: 44, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.tint, borderRadius: 18 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${name}`} disabled={qty <= min} onPress={() => { select(); onChange(qty - 1); }} style={btn(qty <= min)}><Ionicons name={qty <= 1 && min === 0 ? "trash-outline" : "remove"} size={20} color={colors.ink} /></Pressable>
      <Text accessibilityLiveRegion="polite" accessibilityLabel={`${qty} ${name}`} style={{ minWidth: 26, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.ink }}>{qty}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${name}`} disabled={qty >= MAX_QTY} onPress={() => { select(); onChange(qty + 1); }} style={btn(qty >= MAX_QTY)}><Ionicons name="add" size={20} color={colors.ink} /></Pressable>
    </View>
  );
}

/** One menu item, bigger: its picture, price and description, and the buttons to add it. Opened by tapping an item on the menu. */
export default function ItemDetails() {
  const { id } = useLocalSearchParams();
  const { menu, business } = useSite();
  const order = useOrder();
  const { width } = useWindowDimensions();
  const item = useMemo(() => indexMenu(menu).get(String(id)), [menu, id]);
  const side = Math.min(width - 40, 520);
  const ordering = useOrdering();
  const inOrder = item ? order.lines[item.id] || 0 : 0;
  const [qty, setQty] = useState(inOrder || 1);   // how many to add; starts at what is already in the order
  const [added, setAdded] = useState(false);
  useEffect(() => { setQty(inOrder || 1); }, [item?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const more = useMemo(() => (item ? suggestFor(menu, item, Object.keys(order.lines), 6) : []), [menu, item, order.lines]);
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
  const unit = unitCents(item, order.custom[item.id]) ?? item.min, total = unit * qty, from = item.cents == null ? "from " : "";   // the price follows the size and choices
  const changed = qty !== inOrder;
  const leave = () => { if (router.canGoBack()) router.back(); else router.replace("/menu"); };
  const apply = () => {
    if (!changed) { router.replace("/order"); return; }
    order.setQty(item.id, qty);
    success();
    setAdded(true);
    setTimeout(leave, 350);   // a moment to see it was added, then back to the menu
  };
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
            <Small>{ordering ? "Sent to the café with your order." : "Sent with your quote request."} It is a request, not a promise: Maruf Cafe confirms what's possible.</Small>
          </Disclosure>
          <Small>
            Prices are before tax. For ingredients or allergies, please ask Maruf Cafe before you order:{" "}
            <Text accessibilityRole="button" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={() => openLink(`tel:${business.phoneTel}`)} style={{ fontWeight: "800", color: colors.goldText }}>{business.phone}</Text>.
            {item.image ? "" : " The picture is an illustration, not a photo of the dish."}
          </Small>
        </View>
        {more.length ? (
          <View style={{ width: "100%", maxWidth: 560, paddingHorizontal: 20, marginTop: 30 }}>
            <RowHead title="Add something else" />
            <BleedRow>{more.map((it) => <ItemTile key={`more-${it.id}`} item={it} width={140} />)}</BleedRow>
          </View>
        ) : null}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", backgroundColor: colors.surface, paddingTop: 14, paddingBottom: 26, paddingHorizontal: 20, boxShadow: "0px -8px 24px rgba(36,26,18,0.08)" }}>
        <View style={{ width: "100%", maxWidth: 560, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <QtyStepper qty={qty} min={inOrder ? 0 : 1} name={item.name} onChange={setQty} />
          <View style={{ flex: 1 }}>
            <Button
              title={added ? "Added" : !inOrder ? `Add to order · ${from}${money(total)}` : !changed ? "View my order" : qty === 0 ? "Remove from order" : `Update order · ${from}${money(total)}`}
              variant={added ? "primary" : !inOrder || changed ? "gold" : "primary"} icon={added ? "checkmark" : !changed && inOrder ? "bag-handle-outline" : qty === 0 ? "trash-outline" : undefined} style={{ paddingHorizontal: 12 }}
              accessibilityLabel={added ? "Added to your order" : !inOrder ? `Add ${item.name} to order` : undefined}
              onPress={added ? undefined : apply} />
          </View>
        </View>
      </View>
    </View>
  );
}
