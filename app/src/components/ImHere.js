import { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Small } from "./ui";
import { sendImHere } from "../lib/ordering";
import { success, warn } from "../lib/haptics";
import { colors } from "../theme";

/**
 * "I'm here": the customer taps it when they arrive for a pickup order, and the café sees it on its dashboard (and in its chat, if it set one up).
 * Tapping twice does no harm: the café is only told once.
 */
export function ImHere({ id }) {
  const [state, setState] = useState({ phase: "idle", error: "" });   // idle, busy, sent
  if (state.phase === "sent") {
    return (
      <Card accessibilityRole="alert" style={{ padding: 16, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.successSoft }}>
        <Ionicons name="checkmark-circle" size={28} color={colors.success} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: colors.ink }}>The café knows you're here</Text>
          <Small>Please wait nearby. They will bring your order out or call your name.</Small>
        </View>
      </Card>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Button title={state.phase === "busy" ? "Telling the café…" : "I'm here"} variant="gold" icon="location-outline" disabled={state.phase === "busy"} accessibilityLabel="I'm here. Tell the café I have arrived"
        onPress={async () => {
          setState({ phase: "busy", error: "" });
          const r = await sendImHere(id);
          if (r.ok) { success(); setState({ phase: "sent", error: "" }); } else { warn(); setState({ phase: "idle", error: r.error }); }
        }} />
      {state.error ? <Small style={{ color: colors.danger }}>{state.error}</Small> : <Small>Tap when you arrive at the café, so they know to bring out your order.</Small>}
    </View>
  );
}
