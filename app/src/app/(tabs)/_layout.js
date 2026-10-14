import { Image, Linking, Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSite } from "../../lib/site";
import { colors } from "../../theme";

const logo = require("../../../assets/logo-dark.png");

/** Always-visible way to reach the café. */
function CallPill() {
  const { business } = useSite();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={() => Linking.openURL(`tel:${business.phoneTel}`)}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, marginRight: 16, opacity: pressed ? 0.85 : 1, boxShadow: "0px 6px 14px rgba(27,21,17,0.22)" })}>
      <Ionicons name="call" size={15} color={colors.cream} />
      <Text style={{ color: colors.cream, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 }}>CALL</Text>
    </Pressable>
  );
}

const tab = (title, icon, iconActive) => ({
  title,
  tabBarIcon: ({ color, focused }) => (
    <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.goldSoft : "transparent" }}>
      <Ionicons name={focused ? iconActive : icon} size={22} color={color} />
    </View>
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg, height: 84 }, headerShadowVisible: false,
        headerTitle: () => <Image source={logo} accessibilityLabel="Maruf Cafe" resizeMode="contain" style={{ width: 70, height: 52 }} />,
        headerTitleAlign: "left", headerRight: () => <CallPill />,
        tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: "#8F857B",
        tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 0, height: 72, paddingTop: 8, paddingBottom: 10, boxShadow: "0px -8px 28px rgba(36,26,18,0.08)" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
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
