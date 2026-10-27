import { View } from "react-native";
import { Eyebrow, H1, Reveal, TrustBadge } from "../../components/ui";
import { MenuPage, OrderBar } from "../../components/MenuBrowser";
import { CupViewer } from "../../components/Viewers";
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
          <Reveal style={{ marginTop: 18, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Eyebrow>Our food</Eyebrow>
                <H1 style={{ fontSize: 38, lineHeight: 44 }}>Menu</H1>
              </View>
              <TrustBadge label={business.badge} style={{ alignSelf: "flex-end", marginBottom: 6 }} />
            </View>
            <StoreBar style={{ marginTop: 14 }} />
          </Reveal>
        )}
        footer={<View style={{ marginTop: 40 }}><CupViewer /></View>}
      />
      <OrderBar />
    </View>
  );
}
