import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, Card, Chip, Field, H2, Small } from "./ui";
import { calculator } from "../config";
import { plan } from "../lib/plan";
import { colors } from "../theme";
import { money } from "../lib/order";

export default function Calculator() {
  const [guests, setGuests] = useState("");
  const [selected, setSelected] = useState({});
  const result = plan(guests, selected);
  const summary = result.valid
    ? [`Group size: ${result.n} people`, ...result.lines.map((l) => (l.qty != null ? `${l.label}: about ${l.qty}` : `${l.label}: quantity to be confirmed`))].join("\n")
    : "";

  return (
    <Card style={{ padding: 18, gap: 16 }}>
      <H2>Planning Food for a Group?</H2>
      <Body>Tell us how many people you're feeding and what kind of food you're thinking about. This is a planning guide only. Maruf Cafe confirms quantities and pricing with you.</Body>
      <Field label="Number of guests" value={guests} onChangeText={(t) => setGuests(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="For example, 25" maxLength={4} />
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 17, fontWeight: "800", color: colors.ink }}>
        {result.valid ? `Your estimated group size: ${result.n} ${result.n === 1 ? "person" : "people"}.` : "Enter your number of guests to see a plan."}
      </Text>
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>What are you thinking about?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(calculator).map(([k, c]) => <Chip key={k} label={c.label} active={!!selected[k]} onPress={() => setSelected((s) => ({ ...s, [k]: !s[k] }))} />)}
        </View>
      </View>
      {result.valid && result.lines.length > 0 ? (
        <View style={{ backgroundColor: colors.tint, borderRadius: 12, padding: 14, gap: 10 }}>
          {result.lines.map((l) => (
            <View key={l.key} style={{ gap: 2 }}>
              <Text style={{ fontWeight: "800", color: colors.ink }}>{l.label}</Text>
              <Small>{l.qty != null ? `About ${l.qty}${l.total != null ? ` · ${money(Math.round(l.total * 100))}` : ""}` : "Maruf Cafe will confirm the quantity with you."}</Small>
            </View>
          ))}
          <Small>{result.total != null ? `Estimated total ${money(Math.round(result.total * 100))}. Final pricing is confirmed by Maruf Cafe.` : "Final quantities and pricing are confirmed by Maruf Cafe."}</Small>
        </View>
      ) : null}
      <Button title="Add this to my quote request" variant="primary" disabled={!result.valid}
        onPress={() => router.push({ pathname: "/quote", params: { people: String(result.n), foodItems: summary } })} />
    </Card>
  );
}
