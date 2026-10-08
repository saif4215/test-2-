import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Calculator from "./Calculator";
import { Body, Button, Card, H1, H2, H3, IconBadge, Photo, Small } from "./ui";
import { catering, occasions, packages, packagesNote, venueUses } from "../config";
import { colors } from "../theme";

export function LargeOrders() {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <H1>Large Orders</H1>
        <Body>Contact Maruf Cafe for large food orders. Tell us your date, group size and what you'd like, and we'll put a quote together for you. Great for:</Body>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {occasions.map((o) => (
          <View key={o} style={{ backgroundColor: colors.tint, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
            <Text style={{ fontWeight: "700", color: colors.ink, fontSize: 14 }}>{o}</Text>
          </View>
        ))}
      </View>
      <Photo slot="largeOrders" label="Add a photo of a food spread or trays" ratio={1.6} />
      <Button title="Get a large order quote" variant="primary" icon="people-outline" onPress={() => router.push("/quote")} />
      <Calculator />
    </View>
  );
}

export function Catering() {
  return (
    <View style={{ gap: 18 }}>
      <H1>Catering for Every Occasion</H1>
      {catering.map((c) => (
        <Card key={c.title}>
          <Photo slot={c.photo} label={`Add photo: ${c.title}`} ratio={2.2} radiusSize={0} />
          <View style={{ padding: 16, flexDirection: "row", gap: 14, alignItems: "center" }}>
            <IconBadge name={c.icon} />
            <View style={{ flex: 1, gap: 2 }}><H3>{c.title}</H3><Small>{c.body}</Small></View>
          </View>
        </Card>
      ))}
      <Button title="Request catering" variant="primary" onPress={() => router.push({ pathname: "/quote", params: { occasion: "Catering" } })} />
    </View>
  );
}

export function Space() {
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 8 }}>
        <H1>Rent Maruf Cafe for Your Event</H1>
        <Body>Looking for a comfortable place in Staten Island for your next gathering? Maruf Cafe may be available for private events and special occasions.</Body>
      </View>
      <Photo slot="interior" label="Add a photo of the café interior" ratio={1.6} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {venueUses.map((u) => (
          <View key={u.title} style={{ width: "48%", flexGrow: 1, backgroundColor: colors.tint, borderRadius: 14, padding: 14, gap: 10 }}>
            <Ionicons name={u.icon} size={24} color={colors.ink} />
            <Text style={{ fontWeight: "800", fontSize: 15, color: colors.ink }}>{u.title}</Text>
          </View>
        ))}
      </View>
      <Button title="Check event availability" variant="primary" icon="calendar-outline" onPress={() => router.push("/event-request")} />

      <View style={{ gap: 14, marginTop: 10 }}>
        <H2>Event Options</H2>
        {packages.map((p) => (
          <Card key={p.id} style={{ padding: 18, gap: 12 }}>
            <View style={{ gap: 2 }}><H3>{p.title}</H3><Small>{p.blurb}</Small></View>
            {p.includes.map((i) => (
              <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.accentText} />
                <Text style={{ fontSize: 15, color: colors.ink, flex: 1 }}>{i}</Text>
              </View>
            ))}
            <Button title="Ask about this option" variant="light" size="medium" onPress={() => router.push({ pathname: "/event-request", params: { package: p.id } })} />
          </Card>
        ))}
        <Small>{packagesNote}</Small>
      </View>
    </View>
  );
}
