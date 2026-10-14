import { Image, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Calculator from "../../components/Calculator";
import { Body, Button, Card, Grid, H1, H3, Photo, Reveal, Screen, Section, SectionHead, Small } from "../../components/ui";
import { catering, occasions } from "../../config";
import { ART } from "../../lib/menu-art";
import { colors, fonts, gradient, radius, shadowStrong } from "../../theme";

/** The three steps a request goes through. It only describes what the app already does: nothing is booked or charged in the app. */
function Steps() {
  const steps = [["Send your request", "Date, how many people, and what you'd like."], ["Maruf Cafe replies", "We get back to you with a quote."], ["Confirm together", "Nothing is booked until Maruf Cafe confirms it."]];
  return (
    <Card style={{ padding: 20, gap: 0 }}>
      {steps.map(([title, body], i) => (
        <View key={title} style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center" }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}><Text style={{ fontWeight: "800", color: colors.ink, fontSize: 15 }}>{i + 1}</Text></View>
            {i < steps.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: colors.line, marginVertical: 4 }} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 14 : 0, paddingTop: 5, gap: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>{title}</Text>
            <Small>{body}</Small>
          </View>
        </View>
      ))}
    </Card>
  );
}

export default function Orders() {
  return (
    <Screen>
      <Reveal style={{ marginTop: 14 }}>
        <View style={[{ borderRadius: radius.hero, overflow: "hidden", padding: 24, gap: 12 }, gradient(colors.espresso, "linear-gradient(165deg, #3E2C1C 0%, #271B12 60%, #1A1109 100%)"), shadowStrong]}>
          <View style={{ position: "absolute", right: -40, bottom: -44, flexDirection: "row" }}>
            <Image source={ART.chicken} accessible={false} style={{ width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: "rgba(217,164,65,0.5)", marginRight: -26 }} />
            <Image source={ART.bowl} accessible={false} style={{ width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: "rgba(217,164,65,0.5)" }} />
          </View>
          <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.gold }}>Groups and parties</Text>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 38, lineHeight: 43, color: colors.cream }}>Large orders</Text>
          <Text style={{ fontSize: 16, lineHeight: 24, color: colors.creamMuted }}>Tell us the date, how many people and what you'd like, and Maruf Cafe will get back to you with a quote.</Text>
          <View style={{ alignItems: "flex-start", marginTop: 6, marginBottom: 46 }}>
            <Button title="Get a large order quote" variant="gold" onPress={() => router.push("/quote")} />
          </View>
        </View>
      </Reveal>

      <Section style={{ marginTop: 22 }}>
        <Body>Good for {occasions.map((o) => o.toLowerCase()).join(", ")}.</Body>
        <View style={{ marginTop: 16 }}><Photo slot="largeOrders" label="Food for a large order" ratio={1.5} /></View>
      </Section>

      <Section style={{ marginTop: 30 }}>
        <SectionHead title="How it works" style={{ marginBottom: 14 }} />
        <Steps />
      </Section>

      <Section style={{ marginTop: 36 }}>
        <SectionHead title="Catering" style={{ marginBottom: 14 }} />
        <Grid min={300} gap={12}>
          {catering.map((c) => (
            <Card key={c.title}>
              <Photo slot={c.photo} label={c.title} ratio={2.1} radiusSize={0} />
              <View style={{ padding: 16, flexDirection: "row", gap: 14, alignItems: "center" }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name={c.icon || "restaurant-outline"} size={23} color={colors.goldText} /></View>
                <View style={{ flex: 1, gap: 2 }}><H3>{c.title}</H3><Small>{c.body}</Small></View>
              </View>
            </Card>
          ))}
        </Grid>
        <View style={{ marginTop: 16 }}><Button title="Request catering" variant="primary" onPress={() => router.push({ pathname: "/quote", params: { occasion: "Catering" } })} /></View>
      </Section>

      <Section style={{ marginTop: 36 }}><Calculator /></Section>
    </Screen>
  );
}
