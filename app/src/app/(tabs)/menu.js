import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Chip, Eyebrow, Grid, H1, H3, Screen, Section, Small } from "../../components/ui";
import { placeholderCategories, showPlaceholders } from "../../config";
import menu from "../../data/menu.json";
import { money, priceText, useOrder } from "../../lib/order";
import { colors } from "../../theme";

const categories = Object.entries(menu.groups).flatMap(([group, cats]) => Object.entries(cats).map(([name, items]) => ({ name, group, items })));

export default function Menu() {
  const [active, setActive] = useState(categories[0].name);
  const order = useOrder();
  const current = categories.find((c) => c.name === active);
  const names = useMemo(() => [...categories.map((c) => c.name), ...placeholderCategories], []);

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomPad={order.count ? 150 : 120}>
        <Section style={{ marginTop: 16 }}>
          <Eyebrow>Our food</Eyebrow>
          <H1 style={{ marginTop: 8 }}>Menu</H1>
          <Body style={{ marginTop: 10 }}>Add what you like to your order. Ordering for a big group? Add items here, then send them with a quote request.</Body>
        </Section>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {names.map((n) => <Chip key={n} label={n} active={n === active} onPress={() => setActive(n)} />)}
        </ScrollView>

        <View style={{ marginTop: 22 }}>
          {current ? (
            <Grid min={330} gap={14}>
              {current.items.map((it) => {
                const qty = order.lines[it.id] || 0;
                return (
                  <Card key={it.id} style={{ padding: 14, flexDirection: "row", gap: 14, alignItems: "center" }}>
                    {showPlaceholders ? (
                      <View accessibilityLabel={`Photo placeholder: ${it.name}`} style={{ width: 76, height: 76, borderRadius: 16, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="image-outline" size={24} color={colors.goldText} />
                      </View>
                    ) : null}
                    <View style={{ flex: 1, gap: 4 }}>
                      <H3>{it.name}</H3>
                      {it.desc ? <Small>{it.desc}</Small> : null}
                      <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 16 }}>{priceText(it)}</Text>
                    </View>
                    {qty ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${it.name}`} onPress={() => order.change(it.id, -1)} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}><Ionicons name="remove" size={20} color={colors.ink} /></Pressable>
                        <Text style={{ minWidth: 20, textAlign: "center", fontWeight: "800", fontSize: 16, color: colors.ink }}>{qty}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Add one more ${it.name}`} onPress={() => order.change(it.id, +1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={20} color={colors.cream} /></Pressable>
                      </View>
                    ) : (
                      <Button title="Add" size="medium" variant="outline" accessibilityLabel={`Add ${it.name} to order`} onPress={() => order.change(it.id, +1)} />
                    )}
                  </Card>
                );
              })}
            </Grid>
          ) : (
            <Card style={{ padding: 24, gap: 12 }}>
              <H3>{active}</H3>
              <Body>We're adding {active.toLowerCase()} options. Ask Maruf Cafe for a custom quote for your group and we'll put one together.</Body>
              <Button title="Request a large order" variant="gold" onPress={() => router.push({ pathname: "/quote", params: { occasion: active } })} />
            </Card>
          )}
        </View>
      </Screen>

      {order.count ? (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 14, alignItems: "center", pointerEvents: "box-none" }}>
          <View style={{ width: "100%", maxWidth: 640 }}>
            <Button title={`View my order (${order.count}) · ${order.exact ? money(order.low) : `from ${money(order.low)}`}`} variant="primary" icon="bag-handle-outline" onPress={() => router.push("/order")} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
