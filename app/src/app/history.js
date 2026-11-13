import { useMemo } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, Card, H1, Small } from "../components/ui";
import { FormShell } from "../components/FormShell";
import { money, useOrder } from "../lib/order";
import { describeCustom } from "../lib/customize";
import { useMemory } from "../lib/memory";
import { useSite } from "../lib/site";
import { indexMenu } from "../lib/site-merge";
import { colors } from "../theme";

/** "Mon, Nov 9 · 3:15 PM", in the phone's own time. */
const when = (at) => { const d = new Date(at); return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`; };

/** The orders this phone has placed (the last 20), each with a button to order it again. Kept on the phone only. */
export default function History() {
  const { history } = useMemory();
  const { menu } = useSite();
  const order = useOrder();
  const byId = useMemo(() => indexMenu(menu), [menu]);
  return (
    <FormShell>
      <H1>Past orders</H1>
      {history.length === 0 ? (
        <View style={{ gap: 12 }}>
          <Body>Orders you place in the app will show up here, so you can order them again in one tap.</Body>
          <Button title="Browse the menu" variant="gold" onPress={() => router.replace("/menu")} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {history.map((o) => {
            const lines = o.lines.map((l) => ({ ...l, item: byId.get(l.id) })).filter((l) => l.item && !l.item.hidden);
            const gone = o.lines.length - lines.length;
            return (
              <Card key={o.at} style={{ padding: 16, gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", color: colors.goldText }}>{when(o.at)}</Text>
                {lines.map((l) => (
                  <View key={`${o.at}-${l.id}`} style={{ gap: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{l.qty} × {l.item.name}</Text>
                    {describeCustom(l.item, l.choice) ? <Small>{describeCustom(l.item, l.choice)}</Small> : null}
                  </View>
                ))}
                {gone ? <Small>{gone === 1 ? "1 item is" : `${gone} items are`} no longer on the menu.</Small> : null}
                {o.subtotal != null ? <Small>Subtotal {money(o.subtotal)} before tax</Small> : null}
                {lines.length ? <Button title="Order this again" variant="gold" size="medium" icon="repeat" accessibilityLabel={`Order the ${when(o.at)} order again`} onPress={() => { order.addMany(lines.map((l) => ({ id: l.id, qty: l.qty, choice: l.choice }))); router.replace("/order"); }} /> : null}
              </Card>
            );
          })}
        </View>
      )}
    </FormShell>
  );
}
