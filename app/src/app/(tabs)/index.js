import { Image, Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Display, Eyebrow, Grid, H1, H2, H3, IconBadge, Photo, Screen, Section, Small } from "../../components/ui";
import { MapCard } from "../../components/MapCard";
import { MenuBrowser, OrderBar } from "../../components/MenuBrowser";
import { useOrder } from "../../lib/order";
import { useSite } from "../../lib/site";
import { openStatus } from "../../lib/dates";
import { colors, radius, text } from "../../theme";

export default function Home() {
  const { business, reviews, gallery } = useSite();
  const order = useOrder();
  const status = openStatus(business.hours);
  return (
    <View style={{ flex: 1 }}>
    <Screen bottomPad={order.count ? 150 : 120}>
      {/* the food comes first */}
      <View style={{ marginTop: 12, gap: 16 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.open ? colors.success : colors.muted }} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.ink }}>{status.text}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line }}>
            <Ionicons name="location-outline" size={14} color={colors.goldText} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.ink }}>Staten Island, NY</Text>
          </View>
        </View>
        {/* start here: one big way in, two smaller ones */}
        <Pressable accessibilityRole="button" accessibilityLabel="Start an order" onPress={() => router.push("/menu")}
          style={({ pressed }) => ({ backgroundColor: colors.espresso, borderRadius: radius.card, padding: 26, minHeight: 215, gap: 14, justifyContent: "space-between", opacity: pressed ? 0.92 : 1 })}>
          <Text style={[text.eyebrow, { color: colors.gold }]}>Order food</Text>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 44, lineHeight: 48, fontWeight: "900", color: colors.cream, letterSpacing: -1 }}>Start an order</Text>
            <Text style={{ fontSize: 16, lineHeight: 23, color: "#D9CFBF" }}>Pick your food from the menu and send it to Maruf Cafe.</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-forward" size={22} color={colors.ink} /></View>
            <Text style={{ color: colors.gold, fontWeight: "800", fontSize: 15 }}>See the menu</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[["Catering", "Food for groups", "restaurant-outline", () => router.push({ pathname: "/quote", params: { occasion: "Catering" } })],
            ["Rent the spot", "Private events", "calendar-outline", () => router.push("/event-request")]].map(([title, sub, icon, go]) => (
            <Pressable key={title} accessibilityRole="button" accessibilityLabel={`${title}: ${sub}`} onPress={go}
              style={({ pressed }) => ({ flex: 1, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: 16, gap: 10, minHeight: 112, opacity: pressed ? 0.92 : 1 })}>
              <IconBadge name={icon} />
              <View><Text style={{ fontSize: 17, fontWeight: "800", color: colors.ink }}>{title}</Text><Text style={{ fontSize: 13, color: colors.muted }}>{sub}</Text></View>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Ask Maruf Cafe AI" onPress={() => router.push("/assistant")}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.tint, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16, opacity: pressed ? 0.92 : 1 })}>
          <Ionicons name="sparkles" size={22} color={colors.goldText} />
          <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>Ask Maruf Cafe AI</Text><Text style={{ fontSize: 13, color: colors.muted }}>Menu help, planning for a group, renting the café</Text></View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        <Photo slot="hero" label="Add a hero photo: food spread or café interior" ratio={2} />
      </View>

      <Section style={{ marginTop: 28 }}>
        <Eyebrow>The menu</Eyebrow>
        <H1 style={{ marginTop: 8, marginBottom: 18 }}>Pick your food</H1>
        <MenuBrowser />
        <View style={{ marginTop: 20, gap: 12 }}>
          <Button title="Order pickup on Square Online" variant="primary" icon="open-outline" onPress={() => Linking.openURL(business.orderUrl)} />
        </View>
      </Section>

      {/* quick actions */}
      <View accessibilityRole="toolbar" accessibilityLabel="Quick actions" style={{ flexDirection: "row", gap: 10, marginTop: 32 }}>
        <Button title="Call" size="medium" variant="outline" icon="call-outline" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} style={{ flex: 1 }} />
        <Button title="Large Orders" size="medium" variant="outline" onPress={() => router.push("/orders")} style={{ flex: 1.2 }} />
        <Button title="Rent the Cafe" size="medium" variant="outline" onPress={() => router.push("/events")} style={{ flex: 1.2 }} />
      </View>

      {/* planning band */}
      <Section tone="dark">
        <Eyebrow style={{ color: colors.gold }}>Let us help</Eyebrow>
        <H1 style={{ color: colors.cream, marginTop: 8 }}>Planning a Large Gathering?</H1>
        <Body style={{ color: "#D9CFBF", marginTop: 12 }}>
          Whether you're feeding a large group, planning a birthday party, hosting a business meeting, or looking for a private event space, Maruf Cafe can help make your gathering easy and memorable.
        </Body>
        <View style={{ gap: 12, marginTop: 22 }}>
          <Button title="Request a Large Order" variant="gold" onPress={() => router.push("/quote")} />
          <Button title="Request Event Rental" variant="light" onPress={() => router.push("/event-request")} />
        </View>
      </Section>

      {/* ways we can help */}
      <Section>
        <Eyebrow>What we do</Eyebrow>
        <H1 style={{ marginTop: 8, marginBottom: 20 }}>Made for groups</H1>
        <Grid min={280}>
          {[
            ["Large Orders", "Food for family gatherings, parties, offices and school events.", "basket-outline", "/orders"],
            ["Catering", "Birthdays, business meals, holidays and community events.", "restaurant-outline", "/orders"],
            ["Rent Our Space", "A comfortable private space in Staten Island for your event.", "calendar-outline", "/events"],
            ["Our Menu", "Coffee, breakfast, sandwiches, burgers, wings and sweets.", "cafe-outline", "/menu"],
          ].map(([title, body, icon, to]) => (
            <Card key={title} onPress={() => router.push(to)} label={title} style={{ padding: 20, flexDirection: "row", gap: 16, alignItems: "center" }}>
              <IconBadge name={icon} />
              <View style={{ flex: 1, gap: 4 }}><H3>{title}</H3><Small>{body}</Small></View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Card>
          ))}
        </Grid>
      </Section>

      {gallery.length ? (
        <Section>
          <Eyebrow>Gallery</Eyebrow>
          <H1 style={{ marginTop: 8, marginBottom: 20 }}>Take a look</H1>
          <Grid min={240} gap={12}>
            {gallery.map((g) => <Image key={g.url} source={{ uri: g.url }} accessibilityLabel={g.alt} resizeMode="cover" style={{ width: "100%", aspectRatio: 1.4, borderRadius: radius.card }} />)}
          </Grid>
        </Section>
      ) : null}

      {reviews.length ? (
        <Section>
          <Eyebrow>Reviews</Eyebrow>
          <H1 style={{ marginTop: 8, marginBottom: 20 }}>What customers say</H1>
          <Grid min={280} gap={12}>
            {reviews.map((r) => (
              <Card key={`${r.name}-${r.text.slice(0, 20)}`} style={{ padding: 20, gap: 10 }}>
                <Body>“{r.text}”</Body>
                <Small style={{ fontWeight: "700" }}>{r.name}{r.source ? `, ${r.source}` : ""}</Small>
              </Card>
            ))}
          </Grid>
        </Section>
      ) : null}

      {/* quick contact */}
      <Section>
        <Card style={{ padding: 24, gap: 14 }}>
          <H2>Questions? Talk to us.</H2>
          <MapCard />
          <View style={{ gap: 12, marginTop: 4 }}>
            <Button title="Call us" variant="primary" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
          </View>
        </Card>
      </Section>
    </Screen>
    <OrderBar />
    </View>
  );
}
