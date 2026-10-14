import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Grid, H2, Photo, Reveal, Screen, Section, SectionHead, Small } from "../../components/ui";
import { venueUses } from "../../config";
import { useSite } from "../../lib/site";
import { colors, fonts, gradient, radius, shadowStrong } from "../../theme";

export default function Events() {
  const { packages, packagesNote, venue } = useSite();
  const facts = [["Capacity", venue.capacity, "people-outline"], ["About the space", venue.notes, "information-circle-outline"], ["Policies", venue.policies, "document-text-outline"]].filter(([, v]) => v);
  return (
    <Screen>
      <Reveal style={{ marginTop: 14 }}>
        <View style={[{ borderRadius: radius.hero, overflow: "hidden", padding: 24, gap: 12 }, gradient(colors.espresso, "linear-gradient(165deg, #3E2C1C 0%, #271B12 60%, #1A1109 100%)"), shadowStrong]}>
          <View style={{ position: "absolute", right: -60, top: -60, width: 200, height: 200, borderRadius: 100, borderWidth: 1.5, borderColor: "rgba(217,164,65,0.35)" }} />
          <View style={{ position: "absolute", right: -24, top: -24, width: 128, height: 128, borderRadius: 64, borderWidth: 1.5, borderColor: "rgba(217,164,65,0.2)" }} />
          <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.gold }}>Private events</Text>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 38, lineHeight: 43, color: colors.cream }}>Rent the café</Text>
          <Text style={{ fontSize: 16, lineHeight: 24, color: colors.creamMuted }}>Looking for a place in Staten Island for your next gathering? Maruf Cafe may be available for private events.</Text>
          <View style={{ alignItems: "flex-start", marginTop: 6 }}>
            <Button title="Check a date" variant="gold" icon="calendar-outline" onPress={() => router.push("/event-request")} />
          </View>
        </View>
      </Reveal>

      <Section style={{ marginTop: 26 }}>
        <SectionHead title="Good for" style={{ marginBottom: 14 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {venueUses.map((u) => (
            <View key={u.title} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 99, borderWidth: 1, borderColor: colors.line, paddingVertical: 9, paddingHorizontal: 14 }}>
              <Ionicons name={u.icon} size={17} color={colors.goldText} /><Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>{u.title}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18 }}><Photo slot="interior" label="Inside Maruf Cafe" ratio={1.5} /></View>
        {facts.length ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            {facts.map(([k, v, icon]) => (
              <Card key={k} style={{ padding: 16, flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={21} color={colors.goldText} /></View>
                <View style={{ flex: 1, gap: 2 }}><Small style={{ fontWeight: "800", color: colors.ink }}>{k}</Small><Body>{v}</Body></View>
              </Card>
            ))}
          </View>
        ) : null}
      </Section>

      <Section style={{ marginTop: 36 }}>
        <SectionHead title="Options" style={{ marginBottom: 14 }} />
        <Grid min={300} gap={14}>
          {packages.map((p, i) => (
            <Card key={p.id} style={{ padding: 20, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontWeight: "800", color: colors.goldText }}>{i + 1}</Text></View>
                <H2 style={{ flex: 1 }}>{p.title}</H2>
              </View>
              {p.blurb ? <Small>{p.blurb}</Small> : null}
              {(p.includes || []).length ? (
                <View style={{ gap: 7, marginTop: 2 }}>
                  {p.includes.map((x) => <View key={x} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}><Ionicons name="checkmark-circle" size={19} color={colors.gold} style={{ marginTop: 1 }} /><Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink }}>{x}</Text></View>)}
                </View>
              ) : null}
              {p.price ? <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 17 }}>{p.price}</Text> : null}
              <View style={{ alignItems: "flex-start", marginTop: 4 }}><Button title="Ask about this" variant="outline" size="medium" onPress={() => router.push({ pathname: "/event-request", params: { package: p.title } })} /></View>
            </Card>
          ))}
        </Grid>
        {packagesNote ? <Small style={{ marginTop: 16 }}>{packagesNote}</Small> : null}
      </Section>

      <Section style={{ marginTop: 30 }}>
        <Photo slot="event" label="An event at Maruf Cafe" ratio={1.7} />
      </Section>
    </Screen>
  );
}
