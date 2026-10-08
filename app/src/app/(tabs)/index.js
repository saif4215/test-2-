import { Image, Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Display, Eyebrow, Grid, H1, H2, H3, IconBadge, Photo, Screen, Section, Small } from "../../components/ui";
import { useSite } from "../../lib/site";
import { openStatus } from "../../lib/dates";
import { colors, radius, text } from "../../theme";

export default function Home() {
  const { business, reviews, gallery } = useSite();
  const status = openStatus(business.hours);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.address.join(", "))}`;
  return (
    <Screen>
      {/* hero */}
      <View style={{ marginTop: 12, gap: 20 }}>
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
        <Display>Maruf Cafe — Great Food. Great Gatherings.</Display>
        <Text style={[text.h3, { color: colors.goldText, fontWeight: "600", lineHeight: 26 }]}>Large Orders, Catering & Private Event Space in Staten Island</Text>
        <View style={{ gap: 12 }}>
          <Button title="Order for a large group" variant="primary" icon="basket-outline" onPress={() => router.push("/quote")} />
          <Button title="Rent our space" variant="gold" icon="calendar-outline" onPress={() => router.push("/event-request")} />
        </View>
        <View accessibilityRole="toolbar" accessibilityLabel="Quick actions" style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Call" size="medium" variant="outline" icon="call-outline" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} style={{ flex: 1 }} />
          <Button title="Large Orders" size="medium" variant="outline" onPress={() => router.push("/orders")} style={{ flex: 1.2 }} />
          <Button title="Rent the Cafe" size="medium" variant="outline" onPress={() => router.push("/events")} style={{ flex: 1.2 }} />
        </View>
        <Photo slot="hero" label="Add a hero photo: food spread or café interior" ratio={1.35} />
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
          <Body>{business.address.join(", ")}</Body>
          <View style={{ gap: 12, marginTop: 4 }}>
            <Button title="Call us" variant="primary" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
            <Button title="Get directions" variant="outline" icon="navigate-outline" onPress={() => Linking.openURL(mapsUrl)} />
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
