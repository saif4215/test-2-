import { View } from "react-native";
import { H1, Reveal, TrustBadge } from "../../components/ui";
import { MenuPage, OrderBar } from "../../components/MenuBrowser";
import { CloserLook } from "../../components/Viewers";
import { StoreBar } from "../../components/StoreBar";
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
          <Reveal style={{ marginTop: 18, marginBottom: 4, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <H1 style={{ fontSize: 38, lineHeight: 44 }}>Menu</H1>
              <TrustBadge label={business.badge} />
            </View>
            <StoreBar compact />
          </Reveal>
        )}
        footer={<CloserLook />}
      />
      <OrderBar />
    </View>
  );
}
