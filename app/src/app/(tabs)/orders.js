import { Text, View } from "react-native";
import { router } from "expo-router";
import Calculator from "../../components/Calculator";
import { Body, Button, H1, H3, Photo, Screen, Section, Small } from "../../components/ui";
import { catering, occasions } from "../../config";
import { colors } from "../../theme";

export default function Orders() {
  return (
    <Screen>
      <Section style={{ marginTop: 16 }}>
        <H1>Large orders</H1>
        <Body style={{ marginTop: 12 }}>Tell us the date, how many people and what you'd like, and Maruf Cafe will get back to you with a quote. Good for {occasions.map((o) => o.toLowerCase()).join(", ")}.</Body>
        <View style={{ marginTop: 20 }}><Photo slot="largeOrders" label="Food for a large order" ratio={1.5} /></View>
        <View style={{ marginTop: 20 }}><Button title="Get a large order quote" variant="gold" onPress={() => router.push("/quote")} /></View>
      </Section>

      <Section>
        <H1 style={{ marginBottom: 6 }}>Catering</H1>
        {catering.map((c) => (
          <View key={c.title} style={{ borderTopWidth: 1, borderColor: colors.line, paddingVertical: 14, gap: 2 }}>
            <Photo slot={c.photo} label={c.title} ratio={2.1} style={{ marginBottom: 10 }} />
            <H3>{c.title}</H3><Small>{c.body}</Small>
          </View>
        ))}
        <View style={{ marginTop: 14 }}><Button title="Request catering" variant="primary" onPress={() => router.push({ pathname: "/quote", params: { occasion: "Catering" } })} /></View>
      </Section>

      <Section><Calculator /></Section>
    </Screen>
  );
}
