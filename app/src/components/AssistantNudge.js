import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAssistantMode } from "../lib/assistant";
import { colors, radius, shadow } from "../theme";

/** A slim way into the order helper. It shows only when an AI is connected on the server, because without one the helper cannot put an order together. */
export function AssistantNudge({ style }) {
  const mode = useAssistantMode();
  if (mode !== "ai") return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Tell the assistant what you want and it will put an order together for you to check" onPress={() => router.push("/assistant")}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: "rgba(36,26,18,0.06)", paddingVertical: 10, paddingHorizontal: 12, opacity: pressed ? 0.92 : 1 }, shadow, style]}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="sparkles" size={18} color={colors.goldText} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "800", color: colors.ink }}>Tell us what you want</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted }}>The assistant puts your order together to check</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
