import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Small } from "./ui";
import { Celebrate } from "./Celebrate";
import { Glow } from "./Motion";
import { useMemory } from "../lib/memory";
import { useOrdering } from "../lib/ordering";
import { useSite } from "../lib/site";
import { birthdayOpen } from "../lib/perks-util";
import { success } from "../lib/haptics";
import { colors, fonts } from "../theme";

let celebrated = false;   // the confetti plays once each time the app is opened, not on every visit to Home

/** The first name for a greeting, or "". */
const first = (name) => String(name || "").trim().split(/\s+/)[0] || "";

/**
 * Home, during the customer's birthday week: a happy birthday with confetti and the café's treat (the owner writes it in the dashboard).
 * Before the customer has told the app their birthday, a quiet one-line invitation to do it. Nothing at all when the café offers no treat.
 */
export function BirthdayCard({ style, now }) {
  const { birthday, contact } = useMemory();
  const { birthdayTreat } = useSite();
  const ordering = useOrdering();
  const open = !!birthdayTreat && birthdayOpen(birthday, now ? new Date(now) : new Date());
  const [party, setParty] = useState(0);
  useEffect(() => { if (open && !celebrated) { celebrated = true; setParty(1); success(); } }, [open]);
  if (!birthdayTreat || !ordering) return null;
  if (!birthday) {
    return (
      <Card onPress={() => router.push("/settings")} label="Add your birthday for a treat from Maruf Cafe" style={[{ padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }, style]}>
        <Ionicons name="gift-outline" size={24} color={colors.goldText} />
        <Text style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: "700", color: colors.ink }}>Tell us your birthday for a treat in your birthday week</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Card>
    );
  }
  if (!open) return null;
  const who = first(contact.name);
  return (
    <Glow radius={22} style={style}>
      <Card style={{ padding: 18, gap: 8, backgroundColor: colors.goldSoft }}>
        <Celebrate play={party} />
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="gift" size={26} color={colors.goldDeep} /></View>
          <Text accessibilityRole="header" style={{ flex: 1, minWidth: 0, fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink }}>Happy birthday{who ? `, ${who}` : ""}!</Text>
        </View>
        <Text style={{ fontSize: 17, lineHeight: 24, fontWeight: "700", color: colors.ink }}>Your treat: {birthdayTreat}</Text>
        <Small style={{ color: colors.ink }}>It is added to your order, and the café hands it to you at pickup. Good for this week.</Small>
        <View style={{ alignItems: "flex-start", marginTop: 4 }}><Button title="Start an order" variant="gold" size="medium" icon="arrow-forward" onPress={() => router.push("/menu")} /></View>
      </Card>
    </Glow>
  );
}
