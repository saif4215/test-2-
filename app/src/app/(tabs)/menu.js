import { View } from "react-native";
import { Body, Eyebrow, H1, Reveal, Screen, TrustBadge } from "../../components/ui";
import { MenuBrowser, OrderBar } from "../../components/MenuBrowser";
import { CupViewer } from "../../components/Viewers";
import { useOrder } from "../../lib/order";
import { useSite } from "../../lib/site";

export default function Menu() {
  const order = useOrder();
  const { business } = useSite();
  return (
    <View style={{ flex: 1 }}>
      <Screen bottomPad={order.count ? 150 : 120}>
        <Reveal style={{ marginTop: 18, marginBottom: 22, gap: 10 }}>
          <Eyebrow>Our food</Eyebrow>
          <H1 style={{ fontSize: 38, lineHeight: 44 }}>Menu</H1>
          <TrustBadge label={business.badge} />
          <Body>Add what you like to your order. Ordering for a big group? Add items here, then send them with a quote request.</Body>
        </Reveal>
        <MenuBrowser />
        <View style={{ marginTop: 40 }}><CupViewer /></View>
      </Screen>
      <OrderBar />
    </View>
  );
}
