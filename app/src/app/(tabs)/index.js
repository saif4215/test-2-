import { Image, Linking, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActionTile, Body, Button, Card, Grid, H1, H2, Reveal, Screen, Section, SectionHead, Small, StatusPill, TrustBadge } from "../../components/ui";
import { MapCard } from "../../components/MapCard";
import { BurgerViewer } from "../../components/Viewers";
import { CategoryStrip, FeaturedPicks, OrderBar } from "../../components/MenuBrowser";
import { photos as bundledPhotos } from "../../photos";
import { useOrder } from "../../lib/order";
import { useSite } from "../../lib/site";
import { openStatus } from "../../lib/dates";
import { colors, fonts, gradient, radius, shadowStrong } from "../../theme";

const HERO = {
  burger: require("../../../assets/hero/burger.png"), coffee: require("../../../assets/hero/coffee.png"),
  fries: require("../../../assets/hero/fries.png"), cake: require("../../../assets/hero/cake.png"),
};

/** The food, floating over a warm glow. Sizes follow the card width so it looks the same on a small phone and a big one. */
function FoodCollage({ w, side }) {
  const h = Math.round(w * 0.74);
  const big = Math.round(w * 0.7), cup = Math.round(w * 0.5), cake = Math.round(w * 0.44), fries = Math.round(w * 0.3);
  return (
    <View accessible={false} style={{ width: w, height: h, alignSelf: "center", marginTop: 4, marginBottom: -16 }}>
      <View style={[{ position: "absolute", left: w * 0.5 - w * 0.46, top: -w * 0.04, width: w * 0.92, height: w * 0.92, borderRadius: w }, gradient("transparent", "radial-gradient(circle, rgba(217,164,65,0.42) 0%, rgba(217,164,65,0.12) 45%, rgba(217,164,65,0) 70%)")]} />
      <Image source={HERO.fries} resizeMode="contain" style={{ position: "absolute", right: w * 0.08, top: h * 0.02, width: fries, height: fries * 1.52 }} />
      <Image source={HERO.burger} resizeMode="contain" style={{ position: "absolute", left: (w - big) / 2 + w * 0.02, top: h * 0.08, width: big, height: big * 0.81 }} />
      <Image source={HERO.coffee} resizeMode="contain" style={{ position: "absolute", left: -w * 0.04, bottom: h * 0.0, width: cup, height: cup * 0.7 }} />
      <Image source={HERO.cake} resizeMode="contain" style={{ position: "absolute", right: -w * 0.05, bottom: h * 0.02, width: cake, height: cake * 0.7 }} />
    </View>
  );
}

export default function Home() {
  const { business, reviews, gallery, photos: remotePhotos } = useSite();
  const order = useOrder();
  const status = openStatus(business.hours);
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 980) - (width >= 768 ? 64 : 40);
  const wide = inner >= 640;
  const heroPhoto = bundledPhotos.hero || (remotePhotos.hero ? { uri: remotePhotos.hero } : null);   // the café's own hero photo replaces the food collage
  return (
    <View style={{ flex: 1 }}>
    <Screen bottomPad={order.count ? 150 : 120}>
      <Reveal style={{ marginTop: 10 }}>
        <View style={[{ borderRadius: radius.hero, overflow: "hidden", padding: 22, paddingBottom: 0 }, gradient(colors.espresso, "linear-gradient(165deg, #3E2C1C 0%, #271B12 55%, #1A1109 100%)"), shadowStrong]}>
          {heroPhoto ? (
            <>
              <Image source={heroPhoto} accessible={false} resizeMode="cover" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
              <View style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, gradient("transparent", "linear-gradient(180deg, rgba(26,17,9,0.55) 0%, rgba(26,17,9,0.88) 100%)")]} />
            </>
          ) : null}
          <View style={{ flexDirection: wide ? "row" : "column", alignItems: wide ? "flex-end" : "stretch" }}>
            <View style={{ flex: 1, paddingBottom: wide ? 40 : 0, alignSelf: wide ? "center" : "auto" }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <StatusPill dark open={status.open}>{status.text}</StatusPill>
                <TrustBadge dark label={business.badge} style={{ paddingVertical: 5 }} />
              </View>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: wide ? 60 : 46, lineHeight: wide ? 64 : 50, color: colors.cream, marginTop: 20, letterSpacing: -0.5 }}>Hungry?</Text>
              <Text style={{ fontSize: 16, lineHeight: 24, color: colors.creamMuted, marginTop: 6, maxWidth: 330 }}>Pick your food from the menu and send it to Maruf Cafe.</Text>
              <View style={{ marginTop: 20, alignItems: "flex-start" }}>
                <Button title="Start an order" variant="gold" icon="arrow-forward" onPress={() => router.push("/menu")} style={{ paddingHorizontal: 28 }} />
              </View>
            </View>
            {heroPhoto ? <View style={{ height: 22 }} /> : <FoodCollage side={wide} w={wide ? Math.round(inner * 0.5) : Math.min(inner, 520)} />}
          </View>
        </View>
      </Reveal>

      <Reveal delay={120} style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <ActionTile icon="restaurant-outline" title="Catering" sub="Food for groups" onPress={() => router.push({ pathname: "/quote", params: { occasion: "Catering" } })} />
          <ActionTile icon="calendar-outline" title="Events" sub="Rent the café" label="Rent the spot: private events" onPress={() => router.push("/event-request")} />
          <ActionTile icon="chatbubble-ellipses-outline" title="Ask us" sub="Menu, hours, orders" label="Ask a question" onPress={() => router.push("/assistant")} />
        </View>
      </Reveal>

      <Section style={{ marginTop: 34 }}><CategoryStrip /></Section>

      <Section style={{ marginTop: 34 }}>
        <FeaturedPicks />
        <View style={{ marginTop: 16 }}>
          <Button title="Order pickup on Square Online" variant="light" icon="open-outline" onPress={() => Linking.openURL(business.orderUrl)} />
        </View>
      </Section>

      <Section style={{ marginTop: 34 }}><BurgerViewer /></Section>

      {/* planning band */}
      <Section tone="dark" style={{ marginTop: 40 }}>
        <View style={[{ position: "absolute", right: -70, top: -70, width: 220, height: 220, borderRadius: 110, borderWidth: 1.5, borderColor: "rgba(217,164,65,0.35)" }]} />
        <View style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: "rgba(217,164,65,0.2)" }} />
        <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.gold }}>Groups and events</Text>
        <H1 style={{ color: colors.cream, marginTop: 8 }}>Planning a Large Gathering?</H1>
        <Body style={{ color: colors.creamMuted, marginTop: 12 }}>
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
                <Ionicons name="chatbox-ellipses" size={22} color={colors.gold} />
                <Body>“{r.text}”</Body>
                <Small style={{ fontWeight: "700" }}>{r.name}{r.source ? `, ${r.source}` : ""}</Small>
              </Card>
            ))}
          </Grid>
        </Section>
      ) : null}

      {/* quick contact */}
      <Section>
        <Card style={{ padding: 22, gap: 16 }}>
          <H2>Questions? Talk to us.</H2>
          <MapCard />
          <View style={{ gap: 12, marginTop: 2 }}>
            <Button title="Call us" variant="primary" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
            {business.instagram || business.tiktok ? (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {business.instagram ? <Button title="Instagram" size="medium" variant="light" icon="logo-instagram" onPress={() => Linking.openURL(business.instagram)} style={{ flex: 1 }} /> : null}
                {business.tiktok ? <Button title="TikTok" size="medium" variant="light" icon="logo-tiktok" onPress={() => Linking.openURL(business.tiktok)} style={{ flex: 1 }} /> : null}
              </View>
            ) : null}
          </View>
        </Card>
      </Section>
    </Screen>
    <OrderBar />
    </View>
  );
}
