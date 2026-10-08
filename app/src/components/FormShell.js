import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, H1 } from "./ui";
import { useSite } from "../lib/site";
import { colors } from "../theme";

/** Scrolling form container that keeps fields visible above the keyboard. */
export function FormShell({ children }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: "center", paddingBottom: 60 }}>
        <View style={{ width: "100%", maxWidth: 640, paddingHorizontal: 20, paddingTop: 12, gap: 22 }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Shown only after the server confirmed it stored or sent the request. */
export function ThankYou({ message }) {
  const { business } = useSite();
  return (
    <View style={{ alignItems: "flex-start", gap: 16, paddingTop: 24 }}>
      <Ionicons name="checkmark-circle" size={56} color={colors.success} />
      <H1>Thank you!</H1>
      <Body style={{ fontSize: 18, lineHeight: 27 }}>{message}</Body>
      <View style={{ width: "100%", gap: 12, marginTop: 8 }}>
        <Button title="Done" variant="primary" onPress={() => router.dismissAll?.() ?? router.back()} />
        <Button title="Call us" variant="outline" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
      </View>
    </View>
  );
}

/** A failed send never looks like success. It says what happened and offers the phone. */
export function SendError({ message }) {
  const { business } = useSite();
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="assertive" style={{ backgroundColor: "#FBEAE8", borderColor: colors.danger, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
      <Text style={{ color: colors.danger, fontWeight: "700" }}>{message}</Text>
      <Button title={`Call ${business.phone}`} variant="outline" size="medium" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
    </View>
  );
}
