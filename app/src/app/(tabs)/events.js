import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "react-native";
import { Body, Button, H1, H2, Photo, Screen, Section, Small } from "../../components/ui";
import { venueUses } from "../../config";
import { useSite } from "../../lib/site";
import { colors, text } from "../../theme";

export default function Events() {
  const { packages, packagesNote, venue } = useSite();
  const facts = [["Capacity", venue.capacity], ["About the space", venue.notes], ["Policies", venue.policies]].filter(([, v]) => v);
  return (
    <Screen>
      <Section style={{ marginTop: 16 }}>
        <H1>Rent the café</H1>
        <Body style={{ marginTop: 12 }}>Looking for a place in Staten Island for your next gathering? Maruf Cafe may be available for private events. Good for {venueUses.map((u) => u.title.toLowerCase()).join(", ")}.</Body>
        <View style={{ marginTop: 20 }}><Photo slot="interior" label="Inside Maruf Cafe" ratio={1.5} /></View>
        {facts.length ? (
          <View style={{ marginTop: 18 }}>
            {facts.map(([k, v]) => <View key={k} style={{ borderTopWidth: 1, borderColor: colors.line, paddingVertical: 12, gap: 2 }}><Small style={{ fontWeight: "700" }}>{k}</Small><Body>{v}</Body></View>)}
          </View>
        ) : null}
        <View style={{ marginTop: 20 }}><Button title="Check a date" variant="gold" onPress={() => router.push("/event-request")} /></View>
      </Section>

      <Section>
        <H1 style={{ marginBottom: 12 }}>Options</H1>
        {packages.map((p) => (
          <View key={p.id} style={{ borderTopWidth: 1, borderColor: colors.line, paddingVertical: 16, gap: 8 }}>
            <H2>{p.title}</H2>
            {p.blurb ? <Small>{p.blurb}</Small> : null}
            {(p.includes || []).length ? <Body>{p.includes.join(", ")}.</Body> : null}
            {p.price ? <Text style={{ fontWeight: "700", color: colors.goldText, fontSize: 16 }}>{p.price}</Text> : null}
            <View style={{ alignItems: "flex-start" }}><Button title="Ask about this" variant="outline" size="medium" onPress={() => router.push({ pathname: "/event-request", params: { package: p.title } })} /></View>
          </View>
        ))}
        {packagesNote ? <Small style={{ marginTop: 14 }}>{packagesNote}</Small> : null}
      </Section>

      <Section>
        <Photo slot="event" label="An event at Maruf Cafe" ratio={1.7} />
      </Section>
    </Screen>
  );
}
