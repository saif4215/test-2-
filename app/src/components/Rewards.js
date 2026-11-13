import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Small } from "./ui";
import { useMemory } from "../lib/memory";
import { activePromotions } from "../lib/memory-util";
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

/** The customer's points, on Home (only where the café takes orders in the app, since that is where points come from). */
export function RewardsCard({ style }) {
  const { points } = useMemory();
  const { rewardsNote } = useSite();
  const { on, perDollar } = useOrderingConfig();
  if (on !== true) return null;
  const rate = perDollar === 1 ? "1 point for every $1" : `${perDollar} points for every $1`;
  return (
    <Card style={[{ padding: 16, flexDirection: "row", gap: 14, alignItems: "center" }, style]}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="sparkles" size={24} color={colors.goldText} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text accessibilityLabel={`${points.balance} points`} style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{points.balance} {points.balance === 1 ? "point" : "points"}</Text>
        <Small>Earn {rate} on orders you pick up, counted from the café's own order. Your points are kept on this phone.</Small>
        {rewardsNote ? <Small style={{ color: colors.ink, fontWeight: "700" }}>{rewardsNote}</Small> : null}
      </View>
    </Card>
  );
}
