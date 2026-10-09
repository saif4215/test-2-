import { View } from "react-native";
import { Body, Eyebrow, H1, Screen, Section } from "../../components/ui";
import { MenuBrowser, OrderBar } from "../../components/MenuBrowser";
import { CupViewer } from "../../components/Viewers";
import { useOrder } from "../../lib/order";

export default function Menu() {
  const order = useOrder();
  return (
    <View style={{ flex: 1 }}>
      <Screen bottomPad={order.count ? 150 : 120}>
        <Section style={{ marginTop: 16, marginBottom: 20 }}>
          <Eyebrow>Our food</Eyebrow>
          <H1 style={{ marginTop: 8 }}>Menu</H1>
          <Body style={{ marginTop: 10 }}>Add what you like to your order. Ordering for a big group? Add items here, then send them with a quote request.</Body>
        </Section>
        <View style={{ marginBottom: 24 }}><CupViewer /></View>
        <MenuBrowser />
      </Screen>
      <OrderBar />
    </View>
  );
}
