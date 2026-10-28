import { useState } from "react";
import { Platform, Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MapCard } from "../../components/MapCard";
import { Body, Button, Card, H1, Reveal, Screen, Section, SectionHead, Small, StatusPill } from "../../components/ui";
import { showPlaceholders } from "../../config";
import { useSite } from "../../lib/site";
import { nyWeekday, openStatus } from "../../lib/dates";
import { shareText } from "../../lib/share";
import { colors } from "../../theme";
import { openLink } from "../../lib/links";

/** One line of contact details: a round icon, a small title, then the details. Tap it to act on it, when it can be acted on. */
function InfoRow({ icon, title, children, onPress, label, last }) {
  const inner = (
    <View style={{ flexDirection: "row", gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: last ? 0 : 1, borderColor: colors.line, alignItems: "flex-start" }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={21} color={colors.goldText} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", color: colors.goldText }}>{title}</Text>
        {children}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ alignSelf: "center" }} /> : null}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label || title} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{inner}</Pressable> : inner;
}

function Question({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ padding: 18, flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Text style={{ flex: 1, fontWeight: "800", fontSize: 16, lineHeight: 22, color: colors.ink }}>{q}</Text>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: open ? colors.gold : colors.goldSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name={open ? "remove" : "add"} size={18} color={open ? colors.ink : colors.goldText} /></View>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}><Body>{a}</Body></View> : null}
    </Card>
  );
}

export default function Contact() {
  const { business, faq } = useSite();
  const status = openStatus(business.hours);
  const today = nyWeekday();
  const showEmail = business.email || showPlaceholders;
  const [copied, setCopied] = useState(false);
  async function share() {
    const message = shareText(business);
    try {
      if (Platform.OS !== "web") await Share.share({ message });
      else if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: business.name, text: message });
      else { await navigator.clipboard.writeText(message); setCopied(true); }
    } catch { /* the person closed the share sheet, or sharing is not available here */ }
  }
  return (
    <Screen>
      <Reveal style={{ marginTop: 16, gap: 12 }}>
        <H1 style={{ fontSize: 38, lineHeight: 44 }}>Contact</H1>
        <StatusPill open={status.open}>{status.text}</StatusPill>
      </Reveal>

      <Section style={{ marginTop: 22 }}>
        <Card>
          <InfoRow icon="location-outline" title="Address">{business.address.map((l) => <Text key={l} style={{ fontSize: 16, lineHeight: 23, color: colors.ink }}>{l}</Text>)}</InfoRow>
          <InfoRow icon="call-outline" title="Phone" label={`Call Maruf Cafe at ${business.phone}`} onPress={() => openLink(`tel:${business.phoneTel}`)}><Text style={{ fontSize: 16, lineHeight: 23, color: colors.ink }}>{business.phone}</Text></InfoRow>
          {showEmail ? <InfoRow icon="mail-outline" title="Email" onPress={business.email ? () => openLink(`mailto:${business.email}`) : undefined}><Text style={{ fontSize: 16, lineHeight: 23, color: colors.ink }}>{business.email || "[ADD EMAIL]"}</Text></InfoRow> : null}
          <InfoRow icon="time-outline" title="Hours" last>
            {business.hours.map((h) => {
              const isToday = h.days.includes(today);
              return (
                <View key={h.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ fontSize: 16, lineHeight: 23, color: colors.ink, fontWeight: isToday ? "800" : "400" }}>{h.label}{isToday ? "  ·  today" : ""}</Text>
                  <Text style={{ fontSize: 16, lineHeight: 23, color: colors.ink, fontWeight: isToday ? "800" : "400" }}>{fmt(h.open)} – {fmt(h.close)}</Text>
                </View>
              );
            })}
            <Small style={{ fontWeight: "700", color: status.open ? colors.success : colors.muted, marginTop: 2 }}>{status.text}</Small>
          </InfoRow>
        </Card>
        <View style={{ marginTop: 18 }}><MapCard /></View>
        <View style={{ marginTop: 18, gap: 12 }}>
          <Button title="Call us" variant="primary" icon="call-outline" onPress={() => openLink(`tel:${business.phoneTel}`)} />
          <Button title="Request a large order" variant="gold" onPress={() => router.push("/quote")} />
          <Button title="Ask about event rental" variant="light" onPress={() => router.push("/event-request")} />
          {business.email ? <Button title="Email us" variant="outline" icon="mail-outline" onPress={() => openLink(`mailto:${business.email}`)} /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
          {business.instagram ? <Button title="Instagram" size="medium" variant="light" icon="logo-instagram" href={business.instagram} style={{ flex: 1 }} /> : null}
          {business.tiktok ? <Button title="TikTok" size="medium" variant="light" icon="logo-tiktok" href={business.tiktok} style={{ flex: 1 }} /> : null}
          <Button title={copied ? "Copied" : "Share"} size="medium" variant="light" icon={copied ? "checkmark" : "share-outline"} accessibilityLabel={copied ? "Details copied to the clipboard" : "Share Maruf Cafe"} onPress={share} style={{ flex: 1 }} />
        </View>
      </Section>

      <Section style={{ marginTop: 40 }}>
        <SectionHead title="Questions people ask" style={{ marginBottom: 16 }} />
        <View style={{ gap: 12 }}>{faq.map((f) => <Question key={f.q} {...f} />)}</View>
      </Section>
    </Screen>
  );
}

function fmt(h) { const w = Math.floor(h) % 24, m = Math.round((h % 1) * 60); return `${w % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${w < 12 ? "AM" : "PM"}`; }
