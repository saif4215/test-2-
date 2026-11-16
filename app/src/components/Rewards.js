import { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Small } from "./ui";
import { useMemory } from "../lib/memory";
import { activePromotions, rewardProgress } from "../lib/memory-util";
import { useOrderingConfig } from "../lib/ordering";
import { useSite } from "../lib/site";
import { colors, fonts } from "../theme";

/** "Until Dec 31" for a promotion's last day (YYYY-MM-DD), or "" when it has none. */
const untilText = (until) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(until || "");
  return m ? `Until ${new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";
};

/** The café's promotions, on Home. Nothing is drawn until the owner adds one in the dashboard, and one disappears after its last day. */
export function PromoCards({ style }) {
  const { promotions } = useSite();
  const list = activePromotions(promotions);
  if (!list.length) return null;
  return (
    <View style={[{ gap: 12 }, style]}>
      {list.map((p) => (
        <Card key={`${p.title}-${p.until}`} style={{ padding: 16, gap: 4, borderLeftWidth: 5, borderLeftColor: colors.gold }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink }}>{p.title}</Text>
          {p.text ? <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted }}>{p.text}</Text> : null}
          {untilText(p.until) ? <Text style={{ fontSize: 13, fontWeight: "800", color: colors.goldText }}>{untilText(p.until)}</Text> : null}
        </Card>
      ))}
    </View>
  );
}

/** The customer's points, on Home (only where the café takes orders in the app, since that is where points come from), and the rewards the café has set up to work toward. */
export function RewardsCard({ style }) {
  const { points, spendPoints } = useMemory();
  const { rewards, rewardsNote } = useSite();
  const { on, perDollar } = useOrderingConfig();
  const [using, setUsing] = useState(null);   // a reward the customer is about to show at the counter
  if (on !== true) return null;
  const rate = perDollar === 1 ? "1 point for every $1" : `${perDollar} points for every $1`;
  const prog = rewardProgress(rewards, points.balance);
  return (
    <Card style={[{ padding: 16, gap: 14 }, style]}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="sparkles" size={24} color={colors.goldText} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text accessibilityLabel={`${points.balance} points`} style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{points.balance} {points.balance === 1 ? "point" : "points"}</Text>
          <Small>Earn {rate} on orders you pick up, counted from the café's own order. Your points are kept on this phone.</Small>
          {rewardsNote ? <Small style={{ color: colors.ink, fontWeight: "700" }}>{rewardsNote}</Small> : null}
        </View>
      </View>
      {prog.next ? (
        <View style={{ gap: 6 }} accessible accessibilityLabel={`${prog.left} more ${prog.left === 1 ? "point" : "points"} until ${prog.next.title}`}>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: "hidden" }}><View style={{ height: 10, width: `${Math.max(3, Math.round(prog.pct * 100))}%`, backgroundColor: colors.gold, borderRadius: 5 }} /></View>
          <Text style={{ fontSize: 15, color: colors.ink }}><Text style={{ fontWeight: "800" }}>{prog.left} more {prog.left === 1 ? "point" : "points"}</Text> until {prog.next.title} ({prog.next.points} points)</Text>
        </View>
      ) : null}
      {using ? (
        <View accessibilityRole="alert" style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.goldSoft }}>
          <Text style={{ fontSize: 13, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", color: colors.goldText }}>Show this to the café</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink }}>{using.title}</Text>
          <Small>Once the café has given it to you, tap Done. That takes {using.points} points off.</Small>
          <Button title={`Done: take ${using.points} points off`} variant="gold" size="medium" onPress={() => { spendPoints(using.points); setUsing(null); }} />
          <Button title="Not now" variant="outline" size="medium" onPress={() => setUsing(null)} />
        </View>
      ) : prog.ready.map((r) => (
        <Button key={`${r.points}-${r.title}`} title={`Use: ${r.title} (${r.points} points)`} variant="gold" size="medium" icon="gift-outline" accessibilityLabel={`Use ${r.title} for ${r.points} points`} onPress={() => setUsing(r)} />
      ))}
    </Card>
  );
}
