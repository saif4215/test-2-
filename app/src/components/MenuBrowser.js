import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Chip, Grid, H3, SectionHead, Small } from "./ui";
import { placeholderCategories, showPlaceholders } from "../config";
import { money, priceText, useOrder } from "../lib/order";
import { useSite } from "../lib/site";
import { featuredItems, searchMenu } from "../lib/site-merge";
import { ART } from "../lib/menu-art";
import { artKey } from "../lib/menu-art-key";
import { colors, fonts, gradient, radius, shadow } from "../theme";

const categoryList = (menu) => Object.entries(menu.groups).flatMap(([group, cats]) => Object.entries(cats).map(([name, items]) => ({ name, group, items: items.filter((i) => !i.hidden) }))).filter((c) => c.items.length);
const artFor = (cat) => ART[artKey({ cat })] || null;

/** Category chips and the items in each, with Add / quantity buttons. Used on the Menu tab. */
export function MenuBrowser() {
  const { menu } = useSite();
  const categories = useMemo(() => categoryList(menu), [menu]);
  const [chosen, setActive] = useState(null);
  const { cat: wantedCat, n: wantedNonce } = useLocalSearchParams();   // a tile on Home can open the Menu on one category
  useEffect(() => { if (wantedCat) setActive(String(wantedCat)); }, [wantedCat, wantedNonce]);
  const [query, setQuery] = useState("");
  const order = useOrder();
  const active = categories.some((c) => c.name === chosen) || placeholderCategories.includes(chosen) ? chosen : categories[0]?.name;   // a category the café removed falls back to the first
  const current = categories.find((c) => c.name === active);
  const names = useMemo(() => [...categories.map((c) => c.name), ...placeholderCategories.filter((p) => !categories.some((c) => c.name === p))], [categories]);

  const q = query.trim();
  const results = useMemo(() => (q ? searchMenu(categories, q) : null), [categories, q]);

  return (
    <View>
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderColor: "rgba(36,26,18,0.06)", borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, minHeight: 54 }, shadow]}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search the menu" placeholderTextColor="#9A9087" accessibilityLabel="Search the menu" returnKeyType="search" autoCorrect={false} autoCapitalize="none" maxLength={60}
          style={{ flex: 1, minHeight: 52, fontSize: 16, color: colors.ink, outlineStyle: "none" }} />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery("")}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable>
        ) : null}
      </View>
      {results ? (
        <View style={{ marginTop: 18, gap: 14 }}>
          {results.length ? (
            <>
              <Small>{results.length} {results.length === 1 ? "item" : "items"} for “{q}”</Small>
              <Grid min={330} gap={14}>{results.map((it) => <ItemCard key={it.id} item={it} />)}</Grid>
            </>
          ) : (
            <Card style={{ padding: 24, gap: 12 }}>
              <H3>Nothing on the menu for “{q}”</H3>
              <Body>Check the spelling, or try a shorter word. Looking for something for a group? Ask Maruf Cafe and we'll put one together.</Body>
              <Button title="Request a large order" variant="gold" onPress={() => router.push("/quote")} />
            </Card>
          )}
        </View>
      ) : (
      <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {names.map((n) => <Chip key={n} label={n} active={n === active} thumb={artFor(n)} onPress={() => setActive(n)} />)}
      </View>
      {current ? <CategoryBanner category={current} /> : null}
      <View style={{ marginTop: 16 }}>
        {current ? (
          <Grid min={330} gap={14}>
            {current.items.map((it) => <ItemCard key={it.id} item={it} />)}
          </Grid>
        ) : (
          <Card style={{ padding: 24, gap: 12 }}>
            <H3>{active}</H3>
            <Body>We're adding {String(active).toLowerCase()} options. Ask Maruf Cafe for a custom quote for your group and we'll put one together.</Body>
            <Button title="Request a large order" variant="gold" onPress={() => router.push({ pathname: "/quote", params: { occasion: active } })} />
          </Card>
        )}
      </View>
      </>
      )}
    </View>
  );
}


/** A dark title card for the open category, with its picture. */
function CategoryBanner({ category }) {
  const art = artFor(category.name);
  const n = category.items.length;
  return (
    <View style={[{ marginTop: 20, borderRadius: radius.hero, overflow: "hidden", padding: 22, minHeight: 124, flexDirection: "row", alignItems: "center", gap: 12 }, gradient(colors.espresso, "linear-gradient(135deg, #3A2A1C 0%, #241A12 70%)")]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.gold }}>{category.group}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: colors.cream }}>{category.name}</Text>
        <Text style={{ fontSize: 14, color: colors.creamMuted }}>{n} {n === 1 ? "item" : "items"}</Text>
      </View>
      {art ? <Image source={art} accessible={false} style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: "rgba(217,164,65,0.55)", marginRight: -6 }} /> : null}
    </View>
  );
}

/** The item's own picture if the café added one; otherwise a generic 3D-rendered picture for its kind of food; otherwise a placeholder (hidden in store builds). A picture that fails to load is dropped. */
function ItemPhoto({ item, size = 88, box: boxStyle }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size, borderRadius: radius.image, backgroundColor: colors.tint, ...boxStyle };
  if (item.image && !broken) return <Image source={{ uri: item.image }} accessibilityLabel={item.name} onError={() => setBroken(true)} resizeMode="cover" style={box} />;
  const art = ART[artKey(item)];
  if (art) return <Image source={art} accessible={false} resizeMode="cover" style={box} />;
  if (!showPlaceholders) return null;
  return (
    <View accessibilityLabel={`Photo placeholder: ${item.name}`} style={{ ...box, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="image-outline" size={24} color={colors.goldText} />
    </View>
  );
}

/** Add button that becomes a [ - 2 + ] stepper once the item is in the order. */
function Adder({ item: it }) {
  const order = useOrder();
  const qty = order.lines[it.id] || 0;
  if (!qty) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${it.name} to order`} onPress={() => order.change(it.id, +1)}
        style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.94 : 1 }], boxShadow: "0px 6px 14px rgba(185,130,31,0.35)" })}>
        <Ionicons name="add" size={26} color={colors.ink} />
      </Pressable>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.ink, borderRadius: 24, padding: 3 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${it.name}`} onPress={() => order.change(it.id, -1)} hitSlop={4} style={{ width: 38, height: 40, borderRadius: 19, alignItems: "center", justifyContent: "center" }}><Ionicons name="remove" size={19} color={colors.cream} /></Pressable>
      <Text style={{ minWidth: 18, textAlign: "center", fontWeight: "800", fontSize: 16, color: colors.cream }}>{qty}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add one more ${it.name}`} onPress={() => order.change(it.id, +1)} hitSlop={4} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={20} color={colors.ink} /></Pressable>
    </View>
  );
}

/** One menu item with its price and Add / quantity buttons. */
export function ItemCard({ item: it }) {
  return (
    <Card style={{ padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
      <ItemPhoto item={it} size={84} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <H3>{it.name}</H3>
        {it._cat ? <Small>{it._cat}</Small> : null}
        {it.desc ? <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, color: colors.muted }}>{it.desc}</Text> : null}
        <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 16, marginTop: 2 }}>{priceText(it)}</Text>
      </View>
      <Adder item={it} />
    </Card>
  );
}

/** A tall card for the home screen's horizontal row: big picture, name, price, add. */
function PickCard({ item: it }) {
  return (
    <Card style={{ width: 236 }}>
      <ItemPhoto item={it} size={236} box={{ width: 236, height: 168, borderRadius: 0 }} />
      <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 21, fontWeight: "800", color: colors.ink }}>{it.name}</Text>
          <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 15 }}>{priceText(it)}</Text>
        </View>
        <Adder item={it} />
      </View>
    </Card>
  );
}

/** A row that scrolls sideways and runs out to the screen edges, inside a padded page. */
function BleedRow({ children, gap = 14 }) {
  const { width } = useWindowDimensions();
  const pad = width >= 768 ? 32 : 20;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, paddingVertical: 6, gap }}>
      {children}
    </ScrollView>
  );
}

/** "What are you craving?": a round picture for every menu category. Tapping one opens the Menu on it. */
export function CategoryStrip() {
  const { menu } = useSite();
  const categories = useMemo(() => categoryList(menu), [menu]);
  if (!categories.length) return null;
  return (
    <View style={{ gap: 14 }}>
      <SectionHead title="Browse the menu" action="See all" onAction={() => router.push("/menu")} />
      <BleedRow gap={16}>
        {categories.map((c) => {
          const art = artFor(c.name);
          return (
            <Pressable key={c.name} accessibilityRole="button" accessibilityLabel={`${c.name}, ${c.items.length} items`} onPress={() => router.push({ pathname: "/menu", params: { cat: c.name, n: String(Date.now()) } })}
              style={({ pressed }) => ({ width: 88, alignItems: "center", gap: 8, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <View style={[{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.tint, overflow: "hidden", alignItems: "center", justifyContent: "center" }, shadow]}>
                {art ? <Image source={art} accessible={false} style={{ width: 84, height: 84 }} /> : <Ionicons name="restaurant-outline" size={28} color={colors.goldText} />}
              </View>
              <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 17, fontWeight: "700", color: colors.ink, textAlign: "center" }}>{c.name}</Text>
            </Pressable>
          );
        })}
      </BleedRow>
    </View>
  );
}

/** The few items the café picked for the home screen, in a row you can swipe. Hidden when none are picked. */
export function FeaturedPicks() {
  const { menu, featuredTitle } = useSite();
  const picks = useMemo(() => featuredItems(menu), [menu]);
  if (!picks.length) return null;
  return (
    <View style={{ gap: 14 }}>
      <SectionHead title={featuredTitle} />
      <BleedRow>{picks.map((it) => <PickCard key={it.id} item={it} />)}</BleedRow>
    </View>
  );
}

/** Floating "View my order" button, shown once something has been added. */
export function OrderBar() {
  const order = useOrder();
  if (!order.count) return null;
  return (
    <View style={{ position: "absolute", left: 16, right: 16, bottom: 14, alignItems: "center", pointerEvents: "box-none" }}>
      <View style={{ width: "100%", maxWidth: 640 }}>
        <Button title={`View my order (${order.count}) · ${order.exact ? money(order.low) : `from ${money(order.low)}`}`} variant="primary" icon="bag-handle-outline" onPress={() => router.push("/order")} />
      </View>
    </View>
  );
}
