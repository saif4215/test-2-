import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BasketBar } from "../../components/BasketBar";
import { ItemRow } from "../../components/Items";
import { ModeToggle, TopBar } from "../../components/TopBar";
import { Button, Photo } from "../../components/ui";
import { business, placeholderCategories } from "../../config";
import { categories } from "../../lib/categories";
import { openStatus } from "../../lib/dates";
import { colors } from "../../theme";

const WRAP = { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16 };
const names = [...categories.map((c) => c.name), ...placeholderCategories];
const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.address.join(", "))}`;

export default function Menu() {
  const params = useLocalSearchParams();
  const scroller = useRef(null);
  const tabScroller = useRef(null);
  const tops = useRef({});
  const [active, setActive] = useState(names[0]);
  const status = openStatus(business.hours);

  const goTo = useCallback((name) => {
    setActive(name);
    const y = tops.current[name];
    if (y != null) scroller.current?.scrollTo({ y: y - 64, animated: true });
  }, []);

  // Arriving from a category icon on Home
  useEffect(() => {
    if (params.cat && names.includes(params.cat)) { const t = setTimeout(() => goTo(params.cat), 150); return () => clearTimeout(t); }
  }, [params.cat, goTo]);

  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y + 90;
    let current = names[0];
    for (const n of names) if (tops.current[n] != null && tops.current[n] <= y) current = n;
    if (current !== active) setActive(current);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Maruf Cafe" />
      <ScrollView ref={scroller} onScroll={onScroll} scrollEventThrottle={32} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* store header */}
        <View style={[WRAP, { gap: 14, paddingTop: 4 }]}>
          <Photo slot="hero" label="Add a hero photo: food spread or café interior" ratio={2} radiusSize={16} />
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: -0.8 }}>Maruf Cafe</Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>Coffee, breakfast, sandwiches, burgers and more · Staten Island, NY</Text>
            <Text style={{ fontSize: 15, color: status.open ? colors.accentText : colors.muted, fontWeight: "700" }}>{status.text}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <ModeToggle />
            <Button title="Group order" size="medium" variant="light" icon="people-outline" onPress={() => router.push("/quote")} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Button title="Directions" size="medium" variant="light" icon="navigate-outline" onPress={() => Linking.openURL(mapsUrl)} />
            <Button title="Call" size="medium" variant="light" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
          </View>
        </View>

        {/* sticky category bar */}
        <View style={{ backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, marginTop: 16 }}>
          <ScrollView ref={tabScroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}>
            {names.map((n) => (
              <Pressable key={n} accessibilityRole="tab" accessibilityState={{ selected: n === active }} onPress={() => goTo(n)} style={{ paddingHorizontal: 14, minHeight: 52, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: n === active ? colors.ink : "transparent" }}>
                <Text style={{ fontSize: 15, fontWeight: n === active ? "800" : "600", color: n === active ? colors.ink : colors.muted }}>{n}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* sections */}
        {categories.map((c) => (
          <View key={c.name} onLayout={(e) => { tops.current[c.name] = e.nativeEvent.layout.y; }} style={[WRAP, { marginTop: 24 }]}>
            <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 }}>{c.name}</Text>
            {c.items.map((it) => <ItemRow key={it.id} item={it} />)}
          </View>
        ))}
        {placeholderCategories.map((n) => (
          <View key={n} onLayout={(e) => { tops.current[n] = e.nativeEvent.layout.y; }} style={[WRAP, { marginTop: 24 }]}>
            <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 }}>{n}</Text>
            <View style={{ backgroundColor: colors.tint, borderRadius: 14, padding: 18, gap: 12, marginTop: 12 }}>
              <Text style={{ fontSize: 15, color: colors.ink }}>We're adding {n.toLowerCase()} options. Ask Maruf Cafe for a custom quote for your group.</Text>
              <Button title="Request a large order" size="medium" variant="primary" onPress={() => router.push({ pathname: "/quote", params: { occasion: n } })} />
            </View>
          </View>
        ))}
      </ScrollView>
      <BasketBar />
    </View>
  );
}
