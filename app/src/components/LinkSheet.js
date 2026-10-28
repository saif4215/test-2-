import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui";
import { onLinkSheet, prettyPhone } from "../lib/links";
import { colors } from "../theme";

/** Shown on a computer when someone taps Call or Email: there is no dialer or mail app to open, so the number is shown with a Copy button. */
export function LinkSheet() {
  const [contact, setContact] = useState(null), [copied, setCopied] = useState(false);
  useEffect(() => onLinkSheet((c) => { setCopied(false); setContact(c); }), []);
  if (!contact) return null;
  const phone = contact.kind === "phone", shown = phone ? prettyPhone(contact.value) : contact.value;
  const copy = async () => { try { await navigator.clipboard.writeText(shown); setCopied(true); } catch { /* the browser refused: the number is on screen to copy by hand */ } };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setContact(null)}>
      <Pressable accessibilityLabel="Close" onPress={() => setContact(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Pressable onPress={() => {}} accessibilityViewIsModal style={{ width: "100%", maxWidth: 420, backgroundColor: colors.bg, borderRadius: 26, padding: 24, gap: 14, alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name={phone ? "call" : "mail"} size={28} color={colors.goldText} /></View>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{phone ? "Call Maruf Cafe" : "Email Maruf Cafe"}</Text>
          <Text selectable style={{ fontSize: 28, fontWeight: "800", color: colors.ink, textAlign: "center" }}>{shown}</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: "center" }}>{phone ? "This device can't place calls. Dial the number from your phone, or copy it." : "This device has no mail app set up. Copy the address and write to us from your mail."}</Text>
          <View style={{ width: "100%", gap: 10, marginTop: 4 }}>
            <Button title={copied ? "Copied" : phone ? "Copy number" : "Copy address"} variant="gold" icon={copied ? "checkmark" : "copy-outline"} onPress={copy} />
            <Button title="Close" variant="outline" size="medium" onPress={() => setContact(null)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
