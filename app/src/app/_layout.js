import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OrderProvider } from "../lib/order";
import { SiteProvider } from "../lib/site";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SiteProvider>
      <OrderProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.ink, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg }, headerTitleStyle: { fontWeight: "800" } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="quote" options={{ presentation: "modal", title: "Large order quote" }} />
          <Stack.Screen name="event-request" options={{ presentation: "modal", title: "Event rental request" }} />
          <Stack.Screen name="assistant" options={{ presentation: "modal", title: "Ask Maruf Cafe" }} />
          <Stack.Screen name="order" options={{ presentation: "modal", title: "My order" }} />
        </Stack>
      </OrderProvider>
      </SiteProvider>
    </SafeAreaProvider>
  );
}
