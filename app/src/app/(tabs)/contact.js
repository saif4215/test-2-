import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MapCard } from "../../components/MapCard";
import { Body, Button, Card, Grid, H1, Screen, Section, Small } from "../../components/ui";
import { showPlaceholders } from "../../config";
import { useSite } from "../../lib/site";
import { openStatus } from "../../lib/dates";
import { colors } from "../../theme";

function InfoCard({ title, children }) {
  return (
    <View style={{ borderTopWidth: 1, borderColor: colors.line, paddingVertical: 14, gap: 2 }}>
      <Small style={{ fontWeight: "700" }}>{title}</Small>{children}
    </View>
  );
}

function Question({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ padding: 18, flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Text style={{ flex: 1, fontWeight: "800", fontSize: 16, color: colors.ink }}>{q}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}><Body>{a}</Body></View> : null}
    </Card>
  );
}

export default function Contact() {
  const { business, faq, reviews } = useSite();
  const status = openStatus(business.hours);
  return (
    <Screen>
      <Section style={{ marginTop: 16 }}>
        <H1>Contact</H1>
        <View style={{ marginTop: 20 }}>
          <Grid min={300} gap={14}>
            <InfoCard title="Address">{business.address.map((l) => <Body key={l}>{l}</Body>)}</InfoCard>
            <InfoCard title="Phone"><Body>{business.phone}</Body></InfoCard>
            {business.email || showPlaceholders ? <InfoCard title="Email"><Body>{business.email || "[ADD EMAIL]"}</Body></InfoCard> : null}
            <InfoCard title="Hours">
              {business.hours.map((h) => <Body key={h.label}>{h.label}: {fmt(h.open)} – {fmt(h.close)}</Body>)}
              <Small style={{ fontWeight: "700", color: status.open ? colors.success : colors.muted }}>{status.text}</Small>
            </InfoCard>
          </Grid>
        </View>
        <View style={{ marginTop: 22 }}><MapCard /></View>
        <View style={{ marginTop: 16, gap: 12 }}>
          <Button title="Call us" variant="primary" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
          <Button title="Request a large order" variant="gold" onPress={() => router.push("/quote")} />
          <Button title="Ask about event rental" variant="light" onPress={() => router.push("/event-request")} />
          {business.email ? <Button title="Email us" variant="outline" icon="mail-outline" onPress={() => Linking.openURL(`mailto:${business.email}`)} /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          {business.instagram ? <Button title="Instagram" size="medium" variant="light" icon="logo-instagram" onPress={() => Linking.openURL(business.instagram)} style={{ flex: 1 }} /> : null}
          {business.tiktok ? <Button title="TikTok" size="medium" variant="light" icon="logo-tiktok" onPress={() => Linking.openURL(business.tiktok)} style={{ flex: 1 }} /> : null}
        </View>
      </Section>

      <Section>
        <H1 style={{ marginBottom: 16 }}>Questions people ask</H1>
        <View style={{ gap: 12 }}>{faq.map((f) => <Question key={f.q} {...f} />)}</View>
      </Section>
    </Screen>
  );
}

function fmt(h) { const w = Math.floor(h) % 24, m = Math.round((h % 1) * 60); return `${w % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${w < 12 ? "AM" : "PM"}`; }
