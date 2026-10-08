import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TopBar } from "../../components/TopBar";
import { business, faq } from "../../config";
import { openStatus } from "../../lib/dates";
import { colors } from "../../theme";

const WRAP = { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16 };
const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.address.join(", "))}`;
const fmt = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

function Tile({ icon, label, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1, backgroundColor: colors.tint, borderRadius: 14, paddingVertical: 18, alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={26} color={colors.ink} />
      <Text style={{ fontWeight: "800", fontSize: 14, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function Line({ icon, title, sub, onPress, last }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line, minHeight: 60 }}>
      <Ionicons name={icon} size={22} color={colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
    </Pressable>
  );
}

function Question({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ paddingVertical: 16, flexDirection: "row", gap: 12, alignItems: "center", minHeight: 56 }}>
        <Text style={{ flex: 1, fontWeight: "700", fontSize: 16, color: colors.ink }}>{q}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
      </Pressable>
      {open ? <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted, paddingBottom: 16 }}>{a}</Text> : null}
    </View>
  );
}

export default function More() {
  const status = openStatus(business.hours);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="More" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[WRAP, { gap: 20, paddingTop: 4 }]}>
          <View style={{ gap: 2 }}>
            <Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: -0.8 }}>Contact Maruf Cafe</Text>
            <Text style={{ fontSize: 15, color: status.open ? colors.accentText : colors.muted, fontWeight: "700" }}>{status.text}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Tile icon="call-outline" label="Call us" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
            <Tile icon="navigate-outline" label="Directions" onPress={() => Linking.openURL(mapsUrl)} />
            <Tile icon="people-outline" label="Group order" onPress={() => router.push("/quote")} />
          </View>
          <View>
            <Line icon="location-outline" title="Address" sub={business.address.join(", ")} onPress={() => Linking.openURL(mapsUrl)} />
            <Line icon="call-outline" title="Phone" sub={business.phone} onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
            <Line icon="mail-outline" title="Email" sub={business.email || "[ADD EMAIL]"} onPress={business.email ? () => Linking.openURL(`mailto:${business.email}`) : undefined} />
            <Line icon="time-outline" title="Hours" sub={business.hours.map((h) => `${h.label}: ${fmt(h.open)} – ${fmt(h.close)}`).join("\n")} />
            <Line icon="calendar-outline" title="Ask about event rental" onPress={() => router.push("/event-request")} />
            <Line icon="logo-instagram" title="Instagram" onPress={() => Linking.openURL(business.instagram)} />
            <Line icon="logo-tiktok" title="TikTok" onPress={() => Linking.openURL(business.tiktok)} last />
          </View>
          <View>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "800", color: colors.ink, letterSpacing: -0.4, marginBottom: 4 }}>Frequently Asked Questions</Text>
            {faq.map((f) => <Question key={f.q} {...f} />)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
