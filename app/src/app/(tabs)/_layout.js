import { Image, Linking, Pressable, Text } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { business } from "../../config";
import { colors } from "../../theme";

const logo = require("../../../assets/logo-dark.png");

/** Always-visible way to reach the café. */
function CallPill() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={() => Linking.openURL(`tel:${business.phoneTel}`)}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, marginRight: 16 }}>
      <Ionicons name="call" size={15} color={colors.cream} />
      <Text style={{ color: colors.cream, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 }}>CALL</Text>
    </Pressable>
  );
}

const tab = (title, icon, iconActive) => ({
  title,
  tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? iconActive : icon} size={size} color={color} />,
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg, height: 84 }, headerShadowVisible: false,
        headerTitle: () => <Image source={logo} accessibilityLabel="Maruf Cafe" resizeMode="contain" style={{ width: 70, height: 52 }} />,
        headerTitleAlign: "left", headerRight: () => <CallPill />,
        tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: "#9A9087",
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab("Home", "home-outline", "home")} />
      <Tabs.Screen name="orders" options={tab("Orders", "basket-outline", "basket")} />
      <Tabs.Screen name="events" options={tab("Events", "calendar-outline", "calendar")} />
      <Tabs.Screen name="menu" options={tab("Menu", "restaurant-outline", "restaurant")} />
      <Tabs.Screen name="contact" options={tab("Contact", "chatbubble-ellipses-outline", "chatbubble-ellipses")} />
    </Tabs>
  );
}
