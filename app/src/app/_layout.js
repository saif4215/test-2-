import { useEffect, useState } from "react";
import { View } from "react-native";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LinkSheet } from "../components/LinkSheet";
import { MemoryProvider } from "../lib/memory";
import { OrderProvider } from "../lib/order";
import { SiteProvider } from "../lib/site";
import { colors } from "../theme";

export default function RootLayout() {
  // The headings use DM Serif Display. Wait for it (briefly) so text does not jump when it arrives; if it never loads, carry on with the fallback.
  const [fontsReady, fontError] = useFonts({ DMSerifDisplay: require("../../assets/fonts/DMSerifDisplay-Regular.ttf") });
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGaveUp(true), 2500); return () => clearTimeout(t); }, []);
  // The shared preview page (which runs this app inside itself) uses this to jump to a screen from its own buttons.
  useEffect(() => { if (typeof window !== "undefined" && window.__MARUF_PREVIEW) window.__previewGo = (path) => router.navigate(path); }, []);
  if (!fontsReady && !fontError && !gaveUp) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <SiteProvider>
      <MemoryProvider>
      <OrderProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.ink, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg }, headerTitleStyle: { fontWeight: "800" }, headerTitleAlign: "left" }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="quote" options={{ presentation: "modal", title: "Large order quote" }} />
          <Stack.Screen name="event-request" options={{ presentation: "modal", title: "Event rental request" }} />
          <Stack.Screen name="assistant" options={{ presentation: "modal", title: "Ask a question" }} />
          <Stack.Screen name="order" options={{ presentation: "modal", title: "My order" }} />
          <Stack.Screen name="item" options={{ presentation: "modal", title: "Details" }} />
        </Stack>
        <LinkSheet />
      </OrderProvider>
      </MemoryProvider>
      </SiteProvider>
    </SafeAreaProvider>
  );
}
