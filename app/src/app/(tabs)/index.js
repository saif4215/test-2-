import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BasketBar } from "../../components/BasketBar";
import { TopBar } from "../../components/TopBar";
import { ItemCard, ItemRow } from "../../components/Items";
import { Photo } from "../../components/ui";
import { business, catering } from "../../config";
import { categories, iconFor } from "../../lib/categories";
import { openStatus } from "../../lib/dates";
import { useOrder } from "../../lib/order";
import { colors } from "../../theme";

const WRAP = { width: "100%", maxWidth: 760, alignSelf: "center" };

function Promo({ title, body, cta, bg, fg, onPress, width }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${cta}`} onPress={onPress}
      style={{ width, minHeight: 168, borderRadius: 16, backgroundColor: bg, padding: 18, justifyContent: "space-between", gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 22, lineHeight: 26, fontWeight: "800", color: fg, letterSpacing: -0.4 }}>{title}</Text>
        <Text style={{ fontSize: 14, lineHeight: 19, color: fg, opacity: 0.85 }}>{body}</Text>
      </View>
      <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: fg === "#FFFFFF" ? "#FFFFFF" : "#000000", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
        <Text style={{ fontWeight: "800", fontSize: 14, color: fg === "#FFFFFF" ? "#000000" : "#FFFFFF" }}>{cta}</Text>
        <Ionicons name="arrow-forward" size={15} color={fg === "#FFFFFF" ? "#000000" : "#FFFFFF"} />
      </View>
    </Pressable>
  );
}

function Row({ title, onMore, children }) {
  return (
    <View style={{ marginTop: 28 }}>
      <View style={[WRAP, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 14 }]}>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 }}>{title}</Text>
        {onMore ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`See all ${title}`} onPress={onMore} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-forward" size={18} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function Home() {
  const { width } = useWindowDimensions();
  const status = openStatus(business.hours);
  const order = useOrder();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = useMemo(() => (q ? categories.flatMap((c) => c.items.filter((i) => i.name.toLowerCase().includes(q))) : []), [q]);
  const promoW = Math.min(300, width - 56);
  const gutter = Math.max(16, (width - 760) / 2 + 16);   // keeps carousels lined up with the centred column on tablets
  const featured = categories.filter((c) => ["Coffee", "Sandwiches", "Burgers"].includes(c.name));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={[WRAP, { paddingHorizontal: 16, gap: 14 }]}>
          {/* where */}
          <Pressable accessibilityRole="button" accessibilityLabel={`${business.address[0]}, ${status.text}. Get directions`} onPress={() => router.navigate("/more")} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="location-sharp" size={16} color={colors.ink} />
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink }}>{business.address[0]}</Text>
            <Text style={{ fontSize: 15, color: status.open ? colors.accentText : colors.muted, fontWeight: "700" }}>· {status.text}</Text>
          </Pressable>
          {order.mode === "delivery" ? (
            <View style={{ backgroundColor: colors.tint, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 14, color: colors.ink }}>Delivery for large orders is arranged with Maruf Cafe. Request a quote and we'll confirm what's possible for your address.</Text>
            </View>
          ) : null}
          {/* search */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.tint, borderRadius: 999, paddingHorizontal: 16, minHeight: 50 }}>
            <Ionicons name="search" size={20} color={colors.ink} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search Maruf Cafe" placeholderTextColor="#6B6B6B" accessibilityLabel="Search Maruf Cafe" returnKeyType="search"
              style={{ flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 12, outlineStyle: "none" }} />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")}><Ionicons name="close-circle" size={20} color={colors.faint} /></Pressable> : null}
          </View>
        </View>

        {q ? (
          <View style={[WRAP, { paddingHorizontal: 16, marginTop: 12 }]}>
            <Text style={{ fontSize: 14, color: colors.muted, marginVertical: 8 }}>{results.length} {results.length === 1 ? "result" : "results"}</Text>
            {results.map((it) => <ItemRow key={it.id} item={it} />)}
            {!results.length ? <Text style={{ fontSize: 16, color: colors.muted, paddingVertical: 24 }}>Nothing matches "{query}". Looking for something for a big group? Try the Group tab.</Text> : null}
          </View>
        ) : (
          <>
            {/* categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
              {categories.map((c) => (
                <Pressable key={c.name} accessibilityRole="button" accessibilityLabel={c.name} onPress={() => router.navigate({ pathname: "/menu", params: { cat: c.name } })} style={{ alignItems: "center", width: 74, gap: 8 }}>
                  <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={iconFor(c.name)} size={28} color={colors.ink} />
                  </View>
                  <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: "700", color: colors.ink, textAlign: "center" }}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* promos */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={promoW + 12} decelerationRate="fast" style={{ marginTop: 24 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}>
              <Promo width={promoW} bg={colors.promoBlack} fg="#FFFFFF" title="Feeding a crowd?" body="Get a quote for large orders, parties and office meals." cta="Group order" onPress={() => router.push("/quote")} />
              <Promo width={promoW} bg={colors.promoGold} fg="#000000" title="Rent our space" body="Birthdays, engagements and private events in Staten Island." cta="Check availability" onPress={() => router.push("/event-request")} />
              <Promo width={promoW} bg={colors.promoGreen} fg="#000000" title="Catering for every occasion" body="Food for family gatherings, business meetings and holidays." cta="Request catering" onPress={() => router.push({ pathname: "/quote", params: { occasion: "Catering" } })} />
              <Promo width={promoW} bg={colors.promoGrey} fg="#000000" title="Plan your food" body="Not sure how much? Try the group size planner." cta="Open planner" onPress={() => router.navigate("/group")} />
            </ScrollView>

            {/* the store */}
            <View style={[WRAP, { paddingHorizontal: 16, marginTop: 28 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Maruf Cafe. View menu" onPress={() => router.navigate("/menu")} style={{ gap: 12 }}>
                <Photo slot="hero" label="Add a hero photo: food spread or café interior" ratio={1.9} radiusSize={16} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>Maruf Cafe</Text>
                    <Text style={{ fontSize: 14, color: colors.muted }}>Great Food. Great Gatherings. · Staten Island, NY</Text>
                    <Text style={{ fontSize: 14, color: status.open ? colors.accentText : colors.muted, fontWeight: "700" }}>{status.text}</Text>
                  </View>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}><Ionicons name="chevron-forward" size={20} color={colors.ink} /></View>
                </View>
              </Pressable>
            </View>

            {/* menu rows */}
            {featured.map((c) => (
              <Row key={c.name} title={c.name} onMore={() => router.navigate({ pathname: "/menu", params: { cat: c.name } })}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
                  {c.items.slice(0, 8).map((it) => <ItemCard key={it.id} item={it} />)}
                </ScrollView>
              </Row>
            ))}

            {/* gatherings */}
            <Row title="Plan a gathering">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
                {catering.map((c) => (
                  <Pressable key={c.title} accessibilityRole="button" accessibilityLabel={c.title} onPress={() => router.navigate("/group")} style={{ width: 180, gap: 8 }}>
                    <Photo slot={c.photo} label={c.title} ratio={1.3} radiusSize={14} />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>{c.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Row>
          </>
        )}
      </ScrollView>
      <BasketBar />
    </View>
  );
}

