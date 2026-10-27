import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Chip, Grid, H3, SectionHead, Small, usePullRefresh } from "./ui";
import { placeholderCategories, showPlaceholders } from "../config";
import { money, priceText, useOrder } from "../lib/order";
import { useMemory } from "../lib/memory";
import { reorderIds } from "../lib/memory-util";
import { useSite } from "../lib/site";
import { featuredItems, indexMenu, searchMenu } from "../lib/site-merge";
import { ART } from "../lib/menu-art";
import { artKey } from "../lib/menu-art-key";
import { colors, fonts, gradient, radius, shadow } from "../theme";

const categoryList = (menu) => Object.entries(menu.groups).flatMap(([group, cats]) => Object.entries(cats).map(([name, items]) => ({ name, group, items: items.filter((i) => !i.hidden) }))).filter((c) => c.items.length);
const artFor = (cat) => ART[artKey({ cat })] || null;
const openItem = (it) => router.push({ pathname: "/item", params: { id: it.id } });

/**
 * The whole menu as one page, like a delivery app: a search bar and category buttons that stay at the top, then one row per
 * category. Swipe a row sideways to go through its items, scroll down for the next category, tap "See all" to open a row as a grid.
 */
export function MenuPage({ header, footer, bottomPad = 120 }) {
  const { menu, featuredTitle } = useSite();
  const { width } = useWindowDimensions();
  const pad = width >= 768 ? 32 : 20;
  const inner = Math.min(width, 980) - pad * 2;
  const categories = useMemo(() => categoryList(menu), [menu]);
  const names = useMemo(() => [...categories.map((c) => c.name), ...placeholderCategories.filter((p) => !categories.some((c) => c.name === p))], [categories]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [grid, setGrid] = useState({});   // categories opened with "See all"
  const scroller = useRef(null), chipBar = useRef(null), activeRef = useRef(null);
  const pos = useRef({ body: 0, sticky: 120, rows: {}, chips: {} });
  const { cat: wantedCat, n: wantedNonce } = useLocalSearchParams();   // a tile on Home can open the Menu on one category
  const q = query.trim();
  const results = useMemo(() => (q ? searchMenu(categories, q) : null), [categories, q]);
  const picks = useMemo(() => featuredItems(menu), [menu]);
  const featuredRow = useRowScroll();
  const current = names.includes(active) ? active : names[0];

  const goTo = (name) => {
    const y = pos.current.rows[name];
    if (y == null) return;
    scroller.current?.scrollTo({ y: Math.max(0, pos.current.body + y - pos.current.sticky - 6), animated: true });
  };
  const pick = (name) => { setActive(name); activeRef.current = name; if (q) { setQuery(""); setTimeout(() => goTo(name), 140); } else goTo(name); };
  useEffect(() => { if (wantedCat) { setQuery(""); setActive(String(wantedCat)); activeRef.current = String(wantedCat); const t = setTimeout(() => goTo(String(wantedCat)), 200); return () => clearTimeout(t); } return undefined; }, [wantedCat, wantedNonce]);

  // keep the highlighted category button in step with the row on screen
  const onScroll = (e) => {
    if (q) return;
    const y = e.nativeEvent.contentOffset.y + pos.current.sticky + 30;
    let cur = names[0];
    for (const n of names) { const ry = pos.current.rows[n]; if (ry != null && pos.current.body + ry <= y) cur = n; }
    if (cur !== activeRef.current) {
      activeRef.current = cur; setActive(cur);
      const x = pos.current.chips[cur]; if (x != null) chipBar.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
    }
  };

  const col = { width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: pad };
  const refreshControl = usePullRefresh();
  return (
    <ScrollView ref={scroller} stickyHeaderIndices={[1]} onScroll={onScroll} scrollEventThrottle={32} keyboardShouldPersistTaps="handled" refreshControl={refreshControl} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: bottomPad }}>
      <View style={col}>{header}</View>

      <View onLayout={(e) => { pos.current.sticky = e.nativeEvent.layout.height; }} style={{ backgroundColor: colors.bg, paddingTop: 8, paddingBottom: 10, zIndex: 5, boxShadow: "0px 10px 14px -12px rgba(36,26,18,0.28)" }}>
        <View style={col}>
          <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderColor: "rgba(36,26,18,0.06)", borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, minHeight: 50 }, shadow]}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search the menu" placeholderTextColor="#9A9087" accessibilityLabel="Search the menu" returnKeyType="search" autoCorrect={false} autoCapitalize="none" maxLength={60}
              style={{ flex: 1, minHeight: 48, fontSize: 16, color: colors.ink, outlineStyle: "none" }} />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery("")}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable>
            ) : null}
          </View>
          <ScrollView ref={chipBar} horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Menu categories" style={{ marginHorizontal: -pad, marginTop: 10 }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8 }}>
            {names.map((n) => (
              <View key={n} onLayout={(e) => { pos.current.chips[n] = e.nativeEvent.layout.x; }}>
                <Chip label={n} small active={!q && n === current} thumb={artFor(n)} onPress={() => pick(n)} />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      <View onLayout={(e) => { pos.current.body = e.nativeEvent.layout.y; }}>
        <View style={col}>
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
            <View style={{ marginTop: 22 }}><PersonalRows /></View>
            {picks.length ? (
              <View style={{ marginTop: 22 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink }}>{featuredTitle}</Text>
                  {featuredRow.arrows}
                </View>
                <BleedRow scrollRef={featuredRow.scrollRef} onScroll={featuredRow.onScroll}>{picks.map((it) => <ItemTile key={`pick-${it.id}`} item={it} />)}</BleedRow>
              </View>
            ) : null}
            {names.map((name) => {
              const cat = categories.find((c) => c.name === name);
              return (
                <View key={name} onLayout={(e) => { pos.current.rows[name] = e.nativeEvent.layout.y; }} style={{ marginTop: 26 }}>
                  {cat ? <MenuRow cat={cat} inner={inner} open={!!grid[name]} onToggle={() => setGrid((g) => ({ ...g, [name]: !g[name] }))} /> : (
                    <Card style={{ padding: 22, gap: 12 }}>
                      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink }}>{name}</Text>
                      <Body>We're adding {name.toLowerCase()} options. Ask Maruf Cafe for a custom quote for your group and we'll put one together.</Body>
                      <Button title="Request a large order" variant="gold" onPress={() => router.push({ pathname: "/quote", params: { occasion: name } })} />
                    </Card>
                  )}
                </View>
              );
            })}
            </>
          )}
        </View>
      </View>
      <View style={col}>{footer}</View>
    </ScrollView>
  );
}

/** One category: its name, then its items to swipe through (or as a grid after "See all"). */
function MenuRow({ cat, inner, open, onToggle }) {
  const n = cat.items.length;
  const gap = 14, cols = Math.max(2, Math.floor((inner + gap) / (160 + gap))), w = Math.floor((inner - gap * (cols - 1)) / cols);
  const row = useRowScroll();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink }}>{cat.name}</Text>
          <Text style={{ fontSize: 14, color: colors.muted, fontWeight: "600" }}>{n}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 2 }}>
          {!open && n > 2 ? row.arrows : null}
          {n > 2 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={open ? `Show fewer ${cat.name}` : `See all ${cat.name}`} onPress={onToggle} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ color: colors.goldText, fontWeight: "800", fontSize: 15 }}>{open ? "Show less" : "See all"}</Text>
              <Ionicons name={open ? "chevron-up" : "chevron-forward"} size={16} color={colors.goldText} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {open ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, columnGap: gap }}>{cat.items.map((it) => <ItemTile key={it.id} item={it} width={w} />)}</View>
      ) : (
        <BleedRow scrollRef={row.scrollRef} onScroll={row.onScroll}>{cat.items.map((it) => <ItemTile key={it.id} item={it} />)}</BleedRow>
      )}
    </View>
  );
}

/** The item's own picture if the café added one; otherwise a generic 3D-rendered picture for its kind of food; otherwise a placeholder (hidden in store builds). A picture that fails to load is dropped. */
export function ItemPhoto({ item, size = 88, box: boxStyle, always }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size, borderRadius: radius.image, backgroundColor: colors.tint, ...boxStyle };
  if (item.image && !broken) return <Image source={{ uri: item.image }} accessibilityLabel={item.name} onError={() => setBroken(true)} resizeMode="cover" style={box} />;
  const art = ART[artKey(item)];
  if (art) return <Image source={art} accessible={false} resizeMode="cover" style={box} />;
  if (!showPlaceholders && !always) return null;
  return (
    <View accessible={!!showPlaceholders} accessibilityLabel={showPlaceholders ? `Photo placeholder: ${item.name}` : undefined} style={{ ...box, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={always && !showPlaceholders ? "restaurant-outline" : "image-outline"} size={always ? 34 : 24} color={colors.goldText} />
    </View>
  );
}

/** Add button that becomes a [ - 2 + ] stepper once the item is in the order. */
export function Adder({ item: it, size = 46 }) {
  const order = useOrder();
  const qty = order.lines[it.id] || 0;
  if (!qty) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${it.name} to order`} onPress={() => order.change(it.id, +1)}
        style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.94 : 1 }], boxShadow: "0px 6px 14px rgba(185,130,31,0.35)" })}>
        <Ionicons name="add" size={Math.round(size * 0.57)} color={colors.ink} />
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

/** A heart to save an item to "Your favorites". On a picture it sits in a small white circle. */
export function FavoriteButton({ item: it, size = 34, onPhoto }) {
  const { favorites, toggleFavorite } = useMemory();
  const on = favorites.includes(it.id);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={on ? `Remove ${it.name} from favorites` : `Add ${it.name} to favorites`} onPress={() => toggleFavorite(it.id)} hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: onPhoto ? "rgba(255,255,255,0.92)" : colors.surface, borderWidth: onPhoto ? 0 : 1, borderColor: colors.line, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Ionicons name={on ? "heart" : "heart-outline"} size={Math.round(size * 0.58)} color={on ? colors.danger : colors.ink} />
    </Pressable>
  );
}

/** One menu item with its price and Add / quantity buttons. */
export function ItemCard({ item: it }) {
  return (
    <Card style={{ padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${it.name}, ${priceText(it)}. Details`} onPress={() => openItem(it)} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: "row", gap: 12, alignItems: "center", opacity: pressed ? 0.85 : 1 })}>
        <ItemPhoto item={it} size={84} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <H3>{it.name}</H3>
          {it._cat ? <Small>{it._cat}</Small> : null}
          {it.desc ? <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, color: colors.muted }}>{it.desc}</Text> : null}
          <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 16, marginTop: 2 }}>{priceText(it)}</Text>
        </View>
      </Pressable>
      <Adder item={it} />
    </Card>
  );
}

/** A menu item as a tile for a swipeable row: picture with the add button on it, then price and name. */
export function ItemTile({ item: it, width = 160 }) {
  return (
    <View style={{ width }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${it.name}, ${priceText(it)}. Details`} onPress={() => openItem(it)} style={({ pressed }) => ({ gap: 9, opacity: pressed ? 0.9 : 1 })}>
        <ItemPhoto item={it} size={width} always box={{ borderRadius: 20 }} />
        <View style={{ gap: 1, paddingHorizontal: 2 }}>
          <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 15 }}>{priceText(it)}</Text>
          <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 20, fontWeight: "600", color: colors.ink }}>{it.name}</Text>
        </View>
      </Pressable>
      <View style={{ position: "absolute", right: 8, top: width - 48 }}><Adder item={it} size={40} /></View>
      <View style={{ position: "absolute", right: 8, top: 8 }}><FavoriteButton item={it} size={34} onPhoto /></View>
    </View>
  );
}

/** A tall card for the home screen's horizontal row: big picture, name, price, add. */
function PickCard({ item: it }) {
  return (
    <Card style={{ width: 236 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${it.name}, ${priceText(it)}. Details`} onPress={() => openItem(it)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        <ItemPhoto item={it} size={236} box={{ width: 236, height: 168, borderRadius: 0 }} />
      </Pressable>
      <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${it.name} details`} onPress={() => openItem(it)} style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 21, fontWeight: "800", color: colors.ink }}>{it.name}</Text>
          <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 15 }}>{priceText(it)}</Text>
        </Pressable>
        <Adder item={it} />
      </View>
    </Card>
  );
}

/** Left and right buttons for a sideways row, on wide screens and computers where swiping is awkward. Phones just swipe. */
function useRowScroll() {
  const { width } = useWindowDimensions();
  const ref = useRef(null), x = useRef(0);
  const go = (dir) => ref.current?.scrollTo({ x: Math.max(0, x.current + dir * 330), animated: true });
  const arrows = Platform.OS === "web" && width >= 700 ? (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[-1, 1].map((d) => (
        <Pressable key={d} accessibilityRole="button" accessibilityLabel={d < 0 ? "Scroll left" : "Scroll right"} onPress={() => go(d)} hitSlop={6}
          style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name={d < 0 ? "chevron-back" : "chevron-forward"} size={18} color={colors.ink} />
        </Pressable>
      ))}
    </View>
  ) : null;
  return { scrollRef: ref, onScroll: (e) => { x.current = e.nativeEvent.contentOffset.x; }, arrows };
}

/** A row that scrolls sideways and runs out to the screen edges, inside a padded page. */
export function BleedRow({ children, gap = 14, scrollRef, onScroll }) {
  const { width } = useWindowDimensions();
  const pad = width >= 768 ? 32 : 20;
  return (
    <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={32} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, paddingVertical: 6, gap }}>
      {children}
    </ScrollView>
  );
}

/** "What are you craving?": a round picture for every menu category. Tapping one opens the Menu on it. */
export function CategoryStrip() {
  const { menu } = useSite();
  const categories = useMemo(() => categoryList(menu), [menu]);
  const row = useRowScroll();
  if (!categories.length) return null;
  return (
    <View style={{ gap: 14 }}>
      <SectionHead title="Browse the menu" extra={row.arrows} action="See all" onAction={() => router.push("/menu")} />
      <BleedRow gap={16} scrollRef={row.scrollRef} onScroll={row.onScroll}>
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
  const row = useRowScroll();
  if (!picks.length) return null;
  return (
    <View style={{ gap: 14 }}>
      <SectionHead title={featuredTitle} extra={row.arrows} />
      <BleedRow scrollRef={row.scrollRef} onScroll={row.onScroll}>{picks.map((it) => <PickCard key={it.id} item={it} />)}</BleedRow>
    </View>
  );
}

/** "Your favorites" and "Order again" (the items of the last order sent): the rows people come back for. Shown only when there is something in them. */
export function PersonalRows({ onTiles }) {
  const { menu } = useSite();
  const { favorites, recent } = useMemory();
  const order = useOrder();
  const byId = useMemo(() => indexMenu(menu), [menu]);
  const favItems = favorites.map((id) => byId.get(id)).filter((it) => it && !it.hidden);
  const again = reorderIds(recent, byId).map((id) => byId.get(id)).filter((it) => it && !it.hidden);
  const favRow = useRowScroll(), againRow = useRowScroll();
  const titleStyle = { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink };
  const head = (title, row, action) => (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
      <Text accessibilityRole="header" style={titleStyle}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 2 }}>
        {row.arrows}
        {action}
      </View>
    </View>
  );
  if (!favItems.length && !again.length) return null;
  const lastLines = (recent[0] || []).filter((l) => byId.has(l.id));
  return (
    <View style={{ gap: 26 }}>
      {again.length ? (
        <View>
          {head("Order again", againRow, (
            <Pressable accessibilityRole="button" accessibilityLabel="Add everything from my last order" onPress={() => order.addMany(lastLines)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="add-circle" size={18} color={colors.goldText} /><Text style={{ color: colors.goldText, fontWeight: "800", fontSize: 15 }}>Add all</Text>
            </Pressable>
          ))}
          <BleedRow scrollRef={againRow.scrollRef} onScroll={againRow.onScroll}>{again.map((it) => <ItemTile key={`again-${it.id}`} item={it} />)}</BleedRow>
        </View>
      ) : null}
      {favItems.length ? (
        <View>
          {head("Your favorites", favRow, null)}
          <BleedRow scrollRef={favRow.scrollRef} onScroll={favRow.onScroll}>{favItems.map((it) => <ItemTile key={`fav-${it.id}`} item={it} />)}</BleedRow>
        </View>
      ) : null}
    </View>
  );
}

/** Floating "View my order" button. It slides up the first time something is added, and the count pops when it changes. */
export function OrderBar() {
  const order = useOrder();
  const slide = useRef(new Animated.Value(0)).current, pop = useRef(new Animated.Value(1)).current, shown = useRef(false), lastCount = useRef(0);
  const visible = order.count > 0;
  useEffect(() => {
    if (visible && !shown.current) { shown.current = true; slide.setValue(0); Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 8, tension: 70 }).start(); }
    if (!visible) { shown.current = false; slide.setValue(0); }
  }, [visible, slide]);
  useEffect(() => {
    if (order.count > lastCount.current && lastCount.current > 0) Animated.sequence([Animated.timing(pop, { toValue: 1.05, duration: 90, useNativeDriver: true }), Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5 })]).start();
    lastCount.current = order.count;
  }, [order.count, pop]);
  if (!visible) return null;
  return (
    <Animated.View style={{ position: "absolute", left: 16, right: 16, bottom: 14, alignItems: "center", pointerEvents: "box-none", opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: pop }] }}>
      <View style={{ width: "100%", maxWidth: 640 }}>
        <Button title={`View my order (${order.count}) · ${order.exact ? money(order.low) : `from ${money(order.low)}`}`} variant="primary" icon="bag-handle-outline" onPress={() => router.push("/order")} />
      </View>
    </Animated.View>
  );
}
