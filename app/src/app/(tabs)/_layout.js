import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useOrder } from "../../lib/order";
import { colors } from "../../theme";

const tab = (title, icon, iconActive, extra = {}) => ({
  title,
  tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? iconActive : icon} size={size} color={color} />,
  ...extra,
});

export default function TabsLayout() {
  const { count } = useOrder();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: "#8A8A8A",
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: colors.line, height: 70, paddingTop: 8, paddingBottom: 10 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab("Home", "home-outline", "home")} />
      <Tabs.Screen name="menu" options={tab("Menu", "restaurant-outline", "restaurant")} />
      <Tabs.Screen name="group" options={tab("Group", "people-outline", "people")} />
      <Tabs.Screen name="basket" options={tab("Basket", "bag-handle-outline", "bag-handle", { tabBarBadge: count || undefined, tabBarBadgeStyle: { backgroundColor: colors.ink, color: "#FFFFFF", fontSize: 11, fontWeight: "800" } })} />
      <Tabs.Screen name="more" options={tab("More", "ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle")} />
    </Tabs>
  );
}
