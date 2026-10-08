import { useState } from "react";
import { Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui";
import { mapLinks } from "../lib/maps";
import { useSite } from "../lib/site";
import { colors, radius } from "../theme";

/** A tappable map card. Tapping it lets the customer pick Google Maps, Apple Maps or Waze. */
export function MapCard() {
  const { business } = useSite();
  const [open, setOpen] = useState(false), [copied, setCopied] = useState(false);
  const links = mapLinks(business.address);
  const go = (url) => { setOpen(false); Linking.openURL(url); };
  const copy = async () => { try { await navigator.clipboard.writeText(business.address.join(", ")); setCopied(true); } catch { /* not available here */ } };
  const canCopy = Platform.OS === "web" && typeof navigator !== "undefined" && !!navigator.clipboard;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Map and directions to ${business.address.join(", ")}`} onPress={() => { setCopied(false); setOpen(true); }}
        style={({ pressed }) => ({ borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.92 : 1, backgroundColor: colors.surface })}>
        {/* a drawn street grid, not a real map: it does not pretend to know exact coordinates */}
        <View style={{ height: 150, backgroundColor: "#EFE6D3", overflow: "hidden" }}>
          {[28, 74, 120].map((y) => <View key={`h${y}`} style={{ position: "absolute", left: 0, right: 0, top: y, height: 10, backgroundColor: "#FBF8F2" }} />)}
          {[40, 130, 230, 330].map((x) => <View key={`v${x}`} style={{ position: "absolute", top: 0, bottom: 0, left: x, width: 10, backgroundColor: "#FBF8F2" }} />)}
          <View style={{ position: "absolute", left: 90, top: 8, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(138,95,27,0.10)" }} />
          <View style={{ position: "absolute", left: 0, right: 0, top: 36, alignItems: "center" }}><Ionicons name="location" size={54} color={colors.danger} /></View>
        </View>
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.ink }}>{business.address[0]}</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>{business.address.slice(1).join(", ")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Ionicons name="navigate" size={16} color={colors.cream} /><Text style={{ color: colors.cream, fontWeight: "800", fontSize: 13 }}>Directions</Text>
          </View>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center" }}>
          <Pressable accessibilityRole="menu" onPress={() => {}} style={{ width: "100%", maxWidth: 520, backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>Get directions</Text>
            <Text style={{ color: colors.muted, fontSize: 15 }}>{business.address.join(", ")}</Text>
            <Button title="Google Maps" variant="primary" icon="map-outline" onPress={() => go(links.google)} />
            {Platform.OS !== "android" ? <Button title="Apple Maps" variant="light" icon="navigate-outline" onPress={() => go(links.apple)} /> : null}
            <Button title="Waze" variant="light" icon="car-outline" onPress={() => go(links.waze)} />
            {canCopy ? <Button title={copied ? "Address copied" : "Copy address"} variant="outline" size="medium" icon="copy-outline" onPress={copy} /> : null}
            <Button title="Cancel" variant="outline" size="medium" onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
