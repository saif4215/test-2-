import { Text, View } from "react-native";
import { router } from "expo-router";
import Calculator from "../../components/Calculator";
import { Body, Button, Card, Eyebrow, Grid, H1, H2, H3, IconBadge, Photo, Screen, Section, Small } from "../../components/ui";
import { catering, occasions } from "../../config";
import { colors } from "../../theme";

export default function Orders() {
  return (
    <Screen>
      <Section style={{ marginTop: 16 }}>
        <Eyebrow>Large Orders</Eyebrow>
        <H1 style={{ marginTop: 8 }}>Large Orders</H1>
        <Body style={{ marginTop: 12 }}>Contact Maruf Cafe for large food orders. Tell us your date, group size and what you'd like, and we'll put a quote together for you. Great for:</Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {occasions.map((o) => (
            <View key={o} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
              <Text style={{ fontWeight: "700", color: colors.ink, fontSize: 14 }}>{o}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 22 }}><Photo slot="largeOrders" label="Add a photo of a food spread or trays" ratio={1.5} /></View>
        <View style={{ marginTop: 22 }}><Button title="Get a large order quote" variant="gold" icon="basket-outline" onPress={() => router.push("/quote")} /></View>
      </Section>

      <Section>
        <Eyebrow>Catering</Eyebrow>
        <H1 style={{ marginTop: 8, marginBottom: 20 }}>Catering for Every Occasion</H1>
        <Grid min={280}>
          {catering.map((c) => (
            <Card key={c.title} style={{ gap: 0 }}>
              <Photo slot={c.photo} label={`Add photo: ${c.title}`} ratio={2.1} radiusSize={0} />
              <View style={{ padding: 18, gap: 8, flexDirection: "row", alignItems: "flex-start" }}>
                <IconBadge name={c.icon} />
                <View style={{ flex: 1, gap: 4 }}><H3>{c.title}</H3><Small>{c.body}</Small></View>
              </View>
            </Card>
          ))}
        </Grid>
        <View style={{ marginTop: 22 }}><Button title="Request catering" variant="primary" onPress={() => router.push({ pathname: "/quote", params: { occasion: "Catering" } })} /></View>
      </Section>

      <Section><Calculator /></Section>
    </Screen>
  );
}
