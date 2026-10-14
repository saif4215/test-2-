import { View } from "react-native";
import { Body, Eyebrow, H1, Reveal, TrustBadge } from "../../components/ui";
import { MenuPage, OrderBar } from "../../components/MenuBrowser";
import { CupViewer } from "../../components/Viewers";
import { useOrder } from "../../lib/order";
import { useSite } from "../../lib/site";

export default function Menu() {
  const order = useOrder();
  const { business } = useSite();
  return (
    <View style={{ flex: 1 }}>
      <MenuPage
        bottomPad={order.count ? 150 : 120}
        header={(
          <Reveal style={{ marginTop: 18, marginBottom: 14, gap: 10 }}>
            <Eyebrow>Our food</Eyebrow>
            <H1 style={{ fontSize: 38, lineHeight: 44 }}>Menu</H1>
            <TrustBadge label={business.badge} />
            <Body>Swipe a row sideways to see more. Add what you like to your order. Ordering for a big group? Add items here, then send them with a quote request.</Body>
          </Reveal>
        )}
        footer={<View style={{ marginTop: 40 }}><CupViewer /></View>}
      />
      <OrderBar />
    </View>
  );
}
