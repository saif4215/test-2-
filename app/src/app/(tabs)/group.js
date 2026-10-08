import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { BasketBar } from "../../components/BasketBar";
import { Catering, LargeOrders, Space } from "../../components/Group";
import { TopBar } from "../../components/TopBar";
import { Chip } from "../../components/ui";
import { colors } from "../../theme";

const tabs = [["orders", "Large orders"], ["catering", "Catering"], ["space", "Rent our space"]];

export default function Group() {
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(["orders", "catering", "space"].includes(params.tab) ? params.tab : "orders");
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Group & events" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={{ width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, gap: 22 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
            {tabs.map(([k, label]) => <Chip key={k} label={label} active={tab === k} onPress={() => setTab(k)} />)}
          </View>
          {tab === "orders" ? <LargeOrders /> : tab === "catering" ? <Catering /> : <Space />}
        </View>
      </ScrollView>
      <BasketBar />
    </View>
  );
}
