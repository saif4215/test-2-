import { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, H3, Small } from "./ui";
import { checkGiftCard, useOrderingConfig } from "../lib/ordering";
import { money } from "../lib/order";
import { useSite } from "../lib/site";
import { openLink } from "../lib/links";
import { colors } from "../theme";

/** "Gift card balance": type the number from the back of a Maruf Cafe gift card to see what is left on it. Shown only where the café's server can ask Square. */
export function GiftCardBalance({ style }) {
  const { giftCards } = useOrderingConfig();
  const { business } = useSite();
  const [number, setNumber] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState(null);   // result: { ok, state, balanceCents } or { ok: false, error }
  if (!giftCards) return null;
  const ready = number.replace(/[\s-]/g, "").length >= 8;
  const check = async () => {
    setBusy(true); setResult(null);
    const r = await checkGiftCard(number);
    setBusy(false); setResult(r);
  };
  return (
    <Card style={[{ padding: 16, gap: 12 }, style]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="gift-outline" size={22} color={colors.goldText} /></View>
        <H3 style={{ flex: 1 }}>Gift card balance</H3>
      </View>
      <Field label="Card number" value={number} onChangeText={(t) => { setNumber(t); setResult(null); }} autoCapitalize="none" autoCorrect={false} hint="The number on the back of your Maruf Cafe gift card." />
      <Button title={busy ? "Checking…" : "Check balance"} variant="gold" size="medium" disabled={busy || !ready} onPress={check} />
      {result && result.ok ? (
        <View accessibilityRole="alert" style={{ gap: 2, padding: 14, borderRadius: 16, backgroundColor: result.state === "ACTIVE" ? colors.successSoft : colors.goldSoft }}>
          {result.state === "ACTIVE" ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", color: colors.success }}>Balance</Text>
              <Text accessibilityLabel={`Balance ${money(result.balanceCents)}`} style={{ fontSize: 30, fontWeight: "800", color: colors.ink }}>{money(result.balanceCents)}</Text>
              <Small>Pay with it at the counter.</Small>
            </>
          ) : <Text style={{ fontSize: 16, color: colors.ink }}>This card is not active right now, so it has no balance to use. Please ask at the café.</Text>}
        </View>
      ) : null}
      {result && !result.ok ? <Small style={{ color: colors.danger }}>{result.error}</Small> : null}
      {business.giftCardsUrl ? <Button title="Buy a gift card" variant="outline" size="medium" icon="open-outline" onPress={() => openLink(business.giftCardsUrl)} /> : null}
    </Card>
  );
}
