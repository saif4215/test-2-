import { Image, Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Grid, H1, H2, Photo, Screen, Section, Small } from "../../components/ui";
import { MapCard } from "../../components/MapCard";
import { BurgerViewer } from "../../components/Viewers";
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
        <Text style={{ fontSize: 14, color: colors.muted }}><Text style={{ color: status.open ? colors.success : colors.muted, fontWeight: "700" }}>{status.text}</Text>{"  ·  Staten Island"}</Text>
        {/* start here: one big way in, two smaller ones */}
        <Pressable accessibilityRole="button" accessibilityLabel="Start an order" onPress={() => router.push("/menu")}
          style={({ pressed }) => ({ backgroundColor: colors.espresso, borderRadius: radius.card, padding: 26, minHeight: 215, gap: 14, justifyContent: "space-between", opacity: pressed ? 0.92 : 1 })}>
          <View />
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 42, lineHeight: 46, fontWeight: "800", color: colors.cream, letterSpacing: -0.5 }}>Start an order</Text>
            <Text style={{ fontSize: 16, lineHeight: 23, color: "#D9CFBF" }}>Pick your food from the menu and send it to Maruf Cafe.</Text>
          </View>
          <Text style={{ color: colors.gold, fontWeight: "700", fontSize: 16 }}>See the menu  →</Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[["Catering", "Food for groups", () => router.push({ pathname: "/quote", params: { occasion: "Catering" } })],
            ["Rent the spot", "Private events", () => router.push("/event-request")]].map(([title, sub, go]) => (
            <Pressable key={title} accessibilityRole="button" accessibilityLabel={`${title}: ${sub}`} onPress={go}
              style={({ pressed }) => ({ flex: 1, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: 16, gap: 4, minHeight: 84, opacity: pressed ? 0.92 : 1 })}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>{title}</Text><Text style={{ fontSize: 14, color: colors.muted }}>{sub}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Ask a question (AI helper)" onPress={() => router.push("/assistant")}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 14, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.ink} />
          <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "600", color: colors.ink }}>Have a question? Ask here</Text><Text style={{ fontSize: 13, color: colors.muted }}>Answered by an AI helper. It can be wrong, so we confirm anything important.</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Photo slot="hero" label="Add a hero photo: food spread or café interior" ratio={2} />
      </View>

      <Section style={{ marginTop: 32 }}><BurgerViewer /></Section>

      <Section style={{ marginTop: 32 }}>
        <H1 style={{ marginBottom: 16 }}>Menu</H1>
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
        <H1 style={{ color: colors.cream }}>Planning a Large Gathering?</H1>
        <Body style={{ color: "#D9CFBF", marginTop: 12 }}>
          Whether you're feeding a large group, planning a birthday party, hosting a business meeting, or looking for a private event space, Maruf Cafe can help make your gathering easy and memorable.
        </Body>
        <View style={{ gap: 12, marginTop: 22 }}>
          <Button title="Request a Large Order" variant="gold" onPress={() => router.push("/quote")} />
          <Button title="Request Event Rental" variant="light" onPress={() => router.push("/event-request")} />
        </View>
      </Section>

      {gallery.length ? (
        <Section>
          <H1 style={{ marginBottom: 16 }}>Photos</H1>
          <Grid min={240} gap={12}>
            {gallery.map((g) => <Image key={g.url} source={{ uri: g.url }} accessibilityLabel={g.alt} resizeMode="cover" style={{ width: "100%", aspectRatio: 1.4, borderRadius: radius.card }} />)}
          </Grid>
        </Section>
      ) : null}

      {reviews.length ? (
        <Section>
          <H1 style={{ marginBottom: 16 }}>What customers say</H1>
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
