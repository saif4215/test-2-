import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Small } from "../components/ui";
import { askAssistant, assistantEnabled } from "../lib/assistant";
import { useSite } from "../lib/site";
import { colors, radius } from "../theme";

const STARTERS = ["What's good for breakfast?", "Help me plan food for 30 people", "How does renting the café work?", "What are your hours?"];

export default function Assistant() {
  const { business } = useSite();
  const [enabled, setEnabled] = useState(null);   // null = checking
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  useEffect(() => { assistantEnabled().then(setEnabled); }, []);
  useEffect(() => { scroller.current?.scrollToEnd?.({ animated: true }); }, [messages, busy]);

  async function send(textIn) {
    const content = (textIn ?? draft).trim();
    if (!content || busy) return;
    const next = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages(next); setDraft(""); setBusy(true);
    const res = await askAssistant(next);
    setMessages([...next, res.ok ? { role: "assistant", content: res.reply } : { role: "assistant", content: res.error, error: true }]);
    setBusy(false);
  }

  const call = () => Linking.openURL(`tel:${business.phoneTel}`);
  const lastIsAnswer = messages.at(-1)?.role === "assistant" && !messages.at(-1).error;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <Stack.Screen options={{ title: "Ask a question" }} />
      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: "center", padding: 20, paddingBottom: 12 }}>
        <View style={{ width: "100%", maxWidth: 640, gap: 12 }}>
          {enabled === null ? <Body>Checking…</Body> : null}
          {enabled === false ? (
            <View style={{ gap: 14, paddingTop: 20 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.goldText} />
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>The assistant isn't switched on yet</Text>
              <Body>You can still ask a person: call us, or send a request and Maruf Cafe will get back to you.</Body>
              <Button title={`Call ${business.phone}`} variant="primary" icon="call-outline" onPress={call} />
              <Button title="Request a large order" variant="gold" onPress={() => router.replace("/quote")} />
              <Button title="Ask about renting the café" variant="light" onPress={() => router.replace("/event-request")} />
            </View>
          ) : null}
          {enabled ? (
            <>
              {messages.length === 0 ? (
                <View style={{ gap: 10 }}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>How can I help?</Text>
                  <Body>Ask about the menu, hours, large orders, catering or renting the café. I can help you plan how much food to get for a group.</Body>
                  {STARTERS.map((s) => <Button key={s} title={s} size="medium" variant="light" onPress={() => send(s)} />)}
                </View>
              ) : null}
              {messages.map((m, i) => (
                <View key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", backgroundColor: m.role === "user" ? colors.ink : m.error ? "#FBEAE8" : colors.surface, borderColor: m.error ? colors.danger : colors.line, borderWidth: m.role === "user" ? 0 : 1, borderRadius: radius.card, padding: 14 }}>
                  <Text selectable accessibilityLabel={`${m.role === "user" ? "You" : "Maruf Cafe assistant"}: ${m.content}`} style={{ fontSize: 16, lineHeight: 23, color: m.role === "user" ? colors.cream : m.error ? colors.danger : colors.ink }}>{m.content}</Text>
                </View>
              ))}
              {busy ? <Small>Thinking…</Small> : null}
              {lastIsAnswer ? (
                <View style={{ gap: 10, marginTop: 6 }}>
                  <Button title="Start a large order request" size="medium" variant="gold" onPress={() => router.replace("/quote")} />
                  <Button title="Ask about renting the café" size="medium" variant="light" onPress={() => router.replace("/event-request")} />
                </View>
              ) : null}
              <Small style={{ marginTop: 8 }}>AI can make mistakes. Maruf Cafe confirms prices, availability and allergies. This chat does not book or charge anything. Don't type card numbers.</Small>
            </>
          ) : null}
        </View>
      </ScrollView>
      {enabled ? (
        <View style={{ borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12, alignItems: "center" }}>
          <View style={{ width: "100%", maxWidth: 640, flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Ask a question…" placeholderTextColor="#9A9087" accessibilityLabel="Your question" multiline maxLength={600} onSubmitEditing={() => send()}
              style={{ flex: 1, minHeight: 48, maxHeight: 120, backgroundColor: colors.bg, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink, outlineStyle: "none" }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={busy || !draft.trim()} onPress={() => send()} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: busy || !draft.trim() ? colors.line : colors.ink, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="arrow-up" size={22} color={colors.cream} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
