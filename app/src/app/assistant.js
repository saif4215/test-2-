import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Small } from "../components/ui";
import { askAssistant, assistantMode } from "../lib/assistant";
import { mergeNote, proposalTotal, readProposal } from "../lib/assistant-util";
import { describeCustom } from "../lib/customize";
import { money, priceText, useOrder } from "../lib/order";
import { useSite } from "../lib/site";
import { indexMenu } from "../lib/site-merge";
import { colors, radius } from "../theme";
import { openLink } from "../lib/links";

const STARTERS = ["What's good for breakfast?", "Help me plan food for 30 people", "How does renting the café work?", "What are your hours?"];
const AI_STARTERS = ["2 iced lattes and a bagel", "What's good for breakfast?", "Help me plan food for 30 people", "What are your hours?"];

/**
 * What the assistant put together, for the customer to check. Nothing is in the order until they tap Add to my order, and even then
 * nothing is sent to the café: they place the order themselves from My order. Prices come from the menu, never from the assistant.
 */
function Proposal({ lines, applied, onAdd }) {
  const total = proposalTotal(lines);
  return (
    <Card style={{ padding: 16, gap: 10, alignSelf: "stretch" }}>
      <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", color: colors.goldText }}>Check before adding</Text>
      {lines.map((l) => (
        <View key={l.id} style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.ink }}>{l.qty} × {l.item.name}</Text>
            <Text style={{ fontSize: 15.5, color: colors.ink }}>{l.unit != null ? money(l.unit * l.qty) : `from ${money(l.item.min * l.qty)}`}</Text>
          </View>
          {describeCustom(l.item, l.choice) ? <Small>{describeCustom(l.item, l.choice)}</Small> : null}
          {l.note ? <Small>Request: {l.note}</Small> : null}
          {l.unit == null ? <Small>{priceText(l.item)} each, depending on size</Small> : null}
        </View>
      ))}
      <View style={{ height: 1, backgroundColor: colors.line }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>{total.exact ? "Subtotal" : "Subtotal (from)"}</Text>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>{money(total.low)}</Text>
      </View>
      {applied ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Text style={{ fontWeight: "800", color: colors.success }}>Added to your order</Text></View>
          <Button title="View my order" variant="primary" size="medium" icon="bag-handle-outline" onPress={() => router.push("/order")} />
        </View>
      ) : (
        <>
          <Button title="Add to my order" variant="gold" size="medium" icon="add" onPress={onAdd} />
          <Small>Nothing is ordered yet. You place the order yourself from My order.</Small>
        </>
      )}
    </Card>
  );
}

export default function Assistant() {
  const { business, menu } = useSite();
  const order = useOrder();
  const byId = useMemo(() => indexMenu(menu), [menu]);
  const [mode, setMode] = useState(undefined);   // undefined = checking, null = not available, "basic" or "ai"
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  useEffect(() => { assistantMode().then(setMode); }, []);
  const enabled = !!mode;
  useEffect(() => { scroller.current?.scrollToEnd?.({ animated: true }); }, [messages, busy]);

  async function send(textIn) {
    const content = (textIn ?? draft).trim();
    if (!content || busy) return;
    const next = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages(next); setDraft(""); setBusy(true);
    const res = await askAssistant(next);
    setMessages([...next, res.ok ? { role: "assistant", content: res.reply, add: res.add, handoff: res.handoff } : { role: "assistant", content: res.error, error: true }]);
    setBusy(false);
  }

  /** Put what the assistant proposed into the order list (the items, then the requests typed for each). */
  const addProposal = (index) => {
    const lines = readProposal(messages[index]?.add, byId);
    if (!lines.length) return;
    order.addMany(lines.map((l) => ({ id: l.id, qty: l.qty, choice: l.choice })));
    for (const l of lines) if (l.note) order.setNote(l.id, mergeNote(order.notes[l.id], l.note));
    setMessages((cur) => cur.map((m, i) => (i === index ? { ...m, applied: true } : m)));
  };

  const call = () => openLink(`tel:${business.phoneTel}`);
  const lastIsAnswer = messages.at(-1)?.role === "assistant" && !messages.at(-1).error;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <Stack.Screen options={{ title: "Ask a question" }} />
      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: "center", padding: 20, paddingBottom: 12 }}>
        <View style={{ width: "100%", maxWidth: 640, gap: 12 }}>
          {mode === undefined ? <Body>Checking…</Body> : null}
          {mode === null ? (
            <View style={{ gap: 14, paddingTop: 20 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.goldText} />
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>The chat isn't available right now</Text>
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
                  <Body>{mode === "ai" ? "Tell me what you'd like and I'll put it together for you to check, or ask about the menu, our hours, large orders, catering or renting the café. Nothing is ordered until you place it yourself." : "Ask about the menu and prices, our hours, large orders, catering or renting the café. Answers come straight from the café's menu and details."}</Body>
                  {(mode === "ai" ? AI_STARTERS : STARTERS).map((s) => <Button key={s} title={s} size="medium" variant="light" onPress={() => send(s)} />)}
                </View>
              ) : null}
              {messages.map((m, i) => {
                const lines = m.role === "assistant" && !m.error ? readProposal(m.add, byId) : [];
                return (
                  <View key={i} style={{ gap: 10 }}>
                    <View style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", backgroundColor: m.role === "user" ? colors.ink : m.error ? colors.dangerSoft : colors.surface, borderColor: m.error ? colors.danger : colors.line, borderWidth: m.role === "user" ? 0 : 1, borderRadius: radius.card, padding: 14 }}>
                      <Text selectable accessibilityLabel={`${m.role === "user" ? "You" : "Maruf Cafe assistant"}: ${m.content}`} style={{ fontSize: 16, lineHeight: 23, color: m.role === "user" ? colors.cream : m.error ? colors.danger : colors.ink }}>{m.content}</Text>
                    </View>
                    {m.role === "assistant" && (m.handoff || m.error) ? (
                      <Button title={`Call ${business.phone}`} accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} variant="primary" size="medium" icon="call" onPress={call} style={{ alignSelf: "flex-start" }} />
                    ) : null}
                    {lines.length ? <Proposal lines={lines} applied={!!m.applied} onAdd={() => addProposal(i)} /> : null}
                  </View>
                );
              })}
              {busy ? <Small>{mode === "ai" ? "Thinking…" : "Looking that up…"}</Small> : null}
              {lastIsAnswer && !messages.at(-1)?.handoff && !readProposal(messages.at(-1)?.add, byId).length ? (
                <View style={{ gap: 10, marginTop: 6 }}>
                  <Button title="Start a large order request" size="medium" variant="gold" onPress={() => router.replace("/quote")} />
                  <Button title="Ask about renting the café" size="medium" variant="light" onPress={() => router.replace("/event-request")} />
                </View>
              ) : null}
              <Small style={{ marginTop: 8 }}>Not sure, or want a person? <Text accessibilityRole="button" accessibilityLabel={`Call Maruf Cafe at ${business.phone}`} onPress={call} style={{ fontWeight: "800", color: colors.goldText }}>Call {business.phone}</Text>. {mode === "ai" ? "AI can make mistakes: check what it puts together. " : "Automatic answers from the café's details. "}Maruf Cafe confirms prices, availability and allergies. This chat does not book or charge anything. Don't type card numbers.</Small>
            </>
          ) : null}
        </View>
      </ScrollView>
      {enabled ? (
        <View style={{ borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12, alignItems: "center" }}>
          <View style={{ width: "100%", maxWidth: 640, flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Ask a question…" placeholderTextColor={colors.placeholder} accessibilityLabel="Your question" multiline maxLength={600} onSubmitEditing={() => send()}
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
