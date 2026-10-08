import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Eyebrow, Grid, H1, H2, H3, IconBadge, Photo, Screen, Section, Small } from "../../components/ui";
import { venueUses } from "../../config";
import { useSite } from "../../lib/site";
import { colors, text } from "../../theme";
import { Text } from "react-native";

export default function Events() {
  const { packages, packagesNote, venue } = useSite();
  const facts = [["Capacity", venue.capacity], ["About the space", venue.notes], ["Policies", venue.policies]].filter(([, v]) => v);
  return (
    <Screen>
      <Section style={{ marginTop: 16 }}>
        <Eyebrow>Venue Rental</Eyebrow>
        <H1 style={{ marginTop: 8 }}>Rent Maruf Cafe for Your Event</H1>
        <Body style={{ marginTop: 12 }}>Looking for a comfortable place in Staten Island for your next gathering? Maruf Cafe may be available for private events and special occasions.</Body>
        <View style={{ marginTop: 22, gap: 12 }}>
          <Photo slot="interior" label="Add a photo of the café interior" ratio={1.5} />
        </View>
        <View style={{ marginTop: 22 }}>
          <Grid min={150} gap={12}>
            {venueUses.map((u) => (
              <Card key={u.title} style={{ padding: 16, gap: 12, alignItems: "flex-start" }}>
                <IconBadge name={u.icon} />
                <H3>{u.title}</H3>
              </Card>
            ))}
          </Grid>
        </View>
        {facts.length ? (
          <Card style={{ padding: 20, gap: 12, marginTop: 22 }}>
            {facts.map(([k, v]) => <View key={k} style={{ gap: 2 }}><Text style={text.eyebrow}>{k}</Text><Body>{v}</Body></View>)}
          </Card>
        ) : null}
        <View style={{ marginTop: 22 }}><Button title="Check event availability" variant="gold" icon="calendar-outline" onPress={() => router.push("/event-request")} /></View>
      </Section>

      <Section>
        <Eyebrow>Event Options</Eyebrow>
        <H1 style={{ marginTop: 8, marginBottom: 20 }}>Event Options</H1>
        <Grid min={290}>
          {packages.map((p) => (
            <Card key={p.id} style={{ padding: 22, gap: 14 }}>
              <View style={{ gap: 4 }}><H2>{p.title}</H2><Small>{p.blurb}</Small></View>
              <View style={{ gap: 8 }}>
                <Text style={text.eyebrow}>Includes</Text>
                {(p.includes || []).map((i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.goldText} />
                    <Text style={{ fontSize: 15, color: colors.ink, flex: 1 }}>{i}</Text>
                  </View>
                ))}
              </View>
              {p.price ? <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 16 }}>{p.price}</Text> : null}
              <Button title="Ask about this option" variant="outline" size="medium" onPress={() => router.push({ pathname: "/event-request", params: { package: p.title } })} />
            </Card>
          ))}
        </Grid>
        {packagesNote ? <Small style={{ marginTop: 18 }}>{packagesNote}</Small> : null}
      </Section>

      <Section>
        <Photo slot="event" label="Add a photo from an event in the space" ratio={1.7} />
      </Section>
    </Screen>
  );
}
