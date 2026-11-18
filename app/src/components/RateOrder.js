import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Small } from "./ui";
import { sendFeedback } from "../lib/ordering";
import { success, select, warn } from "../lib/haptics";
import { colors, radius } from "../theme";

const KEY = "maruf:rated";
const readRated = async () => { try { const v = JSON.parse((await AsyncStorage.getItem(KEY)) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };

/** After pickup: "How was your order?" with 1 to 5 stars and an optional note, sent to the café (only the café sees it). Asked once for each order. */
export function RateOrder({ id }) {
  const [stars, setStars] = useState(0), [comment, setComment] = useState("");
  const [state, setState] = useState({ phase: "checking", error: "" });   // checking, ask, busy, thanks
  useEffect(() => { let live = true; readRated().then((l) => { if (live) setState({ phase: l.includes(id) ? "thanks" : "ask", error: "" }); }); return () => { live = false; }; }, [id]);
  if (state.phase === "checking") return null;
  if (state.phase === "thanks") {
    return (
      <Card accessibilityRole="alert" style={{ padding: 16, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.successSoft }}>
        <Ionicons name="heart" size={26} color={colors.success} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "800", color: colors.ink }}>Thank you for telling us how it went.</Text>
      </Card>
    );
  }
  const send = async () => {
    setState({ phase: "busy", error: "" });
    const r = await sendFeedback(id, stars, comment.trim());
    if (!r.ok) { warn(); setState({ phase: "ask", error: r.error }); return; }
    success();
    try { const l = await readRated(); await AsyncStorage.setItem(KEY, JSON.stringify([id, ...l.filter((x) => x !== id)].slice(0, 30))); } catch { /* not remembered */ }
    setState({ phase: "thanks", error: "" });
  };
  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>How was your order?</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Rating, 1 to 5 stars" style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: stars === n }} accessibilityLabel={`${n} ${n === 1 ? "star" : "stars"}`} onPress={() => { select(); setStars(n); }} hitSlop={4} style={{ padding: 4 }}>
            <Ionicons name={n <= stars ? "star" : "star-outline"} size={38} color={n <= stars ? colors.gold : colors.outline} />
          </Pressable>
        ))}
      </View>
      {stars ? (
        <TextInput value={comment} onChangeText={setComment} placeholder="Anything you'd like to tell us? (optional)" placeholderTextColor={colors.placeholder} accessibilityLabel="Comment about your order" multiline maxLength={500}
          style={{ backgroundColor: colors.bg, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, minHeight: 70, fontSize: 16, color: colors.ink, outlineStyle: "none", textAlignVertical: "top" }} />
      ) : null}
      {state.error ? <Small style={{ color: colors.danger }}>{state.error}</Small> : <Small>Only the café sees this. It helps us get better.</Small>}
      <Button title={state.phase === "busy" ? "Sending…" : "Send"} variant="gold" size="medium" disabled={!stars || state.phase === "busy"} onPress={send} />
    </Card>
  );
}
