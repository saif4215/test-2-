import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Card, Eyebrow, Grid, H1, H2, H3, IconBadge, Screen, Section, Small } from "../../components/ui";
import { business, faq, showPlaceholders } from "../../config";
import { openStatus } from "../../lib/dates";
import { colors } from "../../theme";

const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.address.join(", "))}`;

function InfoCard({ icon, title, children }) {
  return (
    <Card style={{ padding: 20, flexDirection: "row", gap: 16 }}>
      <IconBadge name={icon} />
      <View style={{ flex: 1, gap: 4 }}><H3>{title}</H3>{children}</View>
    </Card>
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
  const status = openStatus(business.hours);
  return (
    <Screen>
      <Section style={{ marginTop: 16 }}>
        <Eyebrow>Get in touch</Eyebrow>
        <H1 style={{ marginTop: 8 }}>Contact Maruf Cafe</H1>
        <View style={{ marginTop: 20 }}>
          <Grid min={300} gap={14}>
            <InfoCard icon="location-outline" title="Address">{business.address.map((l) => <Body key={l}>{l}</Body>)}</InfoCard>
            <InfoCard icon="call-outline" title="Phone"><Body>{business.phone}</Body></InfoCard>
            {business.email || showPlaceholders ? <InfoCard icon="mail-outline" title="Email"><Body>{business.email || "[ADD EMAIL]"}</Body></InfoCard> : null}
            <InfoCard icon="time-outline" title="Hours">
              {business.hours.map((h) => <Body key={h.label}>{h.label}: {fmt(h.open)} – {fmt(h.close)}</Body>)}
              <Small style={{ fontWeight: "700", color: status.open ? colors.success : colors.muted }}>{status.text}</Small>
            </InfoCard>
          </Grid>
        </View>
        <View style={{ marginTop: 22, gap: 12 }}>
          <Button title="Call us" variant="primary" icon="call-outline" onPress={() => Linking.openURL(`tel:${business.phoneTel}`)} />
          <Button title="Get directions" variant="outline" icon="navigate-outline" onPress={() => Linking.openURL(mapsUrl)} />
          <Button title="Request a large order" variant="gold" onPress={() => router.push("/quote")} />
          <Button title="Ask about event rental" variant="light" onPress={() => router.push("/event-request")} />
          {business.email ? <Button title="Email us" variant="outline" icon="mail-outline" onPress={() => Linking.openURL(`mailto:${business.email}`)} /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <Button title="Instagram" size="medium" variant="light" icon="logo-instagram" onPress={() => Linking.openURL(business.instagram)} style={{ flex: 1 }} />
          <Button title="TikTok" size="medium" variant="light" icon="logo-tiktok" onPress={() => Linking.openURL(business.tiktok)} style={{ flex: 1 }} />
        </View>
      </Section>

      <Section>
        <Eyebrow>Good to know</Eyebrow>
        <H1 style={{ marginTop: 8, marginBottom: 20 }}>Frequently Asked Questions</H1>
        <View style={{ gap: 12 }}>{faq.map((f) => <Question key={f.q} {...f} />)}</View>
      </Section>
    </Screen>
  );
}

function fmt(h) { return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`; }
