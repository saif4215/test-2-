import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Calculator from "../../components/Calculator";
import { Body, Button, Disclosure, H1, Photo, Reveal, Screen, SegmentedTabs, Small } from "../../components/ui";
import { catering, venueUses } from "../../config";
import { useSite } from "../../lib/site";
import { ART } from "../../lib/menu-art";
import { colors, fonts, gradient, radius, shadowStrong } from "../../theme";

const VIEWS = [{ value: "food", label: "Food for a group" }, { value: "rent", label: "Rent the café" }];

/** The dark card at the top of each part: what it is, in a sentence, and the one button to start. */
function GroupHero({ eyebrow, title, body, cta, icon, onPress, art }) {
  return (
    <View style={[{ borderRadius: radius.hero, overflow: "hidden", padding: 24, gap: 10 }, gradient(colors.espresso, "linear-gradient(165deg, #3E2C1C 0%, #271B12 60%, #1A1109 100%)"), shadowStrong]}>
      {art ? (
        <View style={{ position: "absolute", right: -40, bottom: -44, flexDirection: "row" }}>
          {art.map((a, i) => <Image key={i} source={a} accessible={false} style={{ width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: "rgba(217,164,65,0.5)", marginRight: i === 0 ? -26 : 0 }} />)}
        </View>
      ) : (
        <>
          <View style={{ position: "absolute", right: -60, top: -60, width: 200, height: 200, borderRadius: 100, borderWidth: 1.5, borderColor: "rgba(217,164,65,0.35)" }} />
          <View style={{ position: "absolute", right: -24, top: -24, width: 128, height: 128, borderRadius: 64, borderWidth: 1.5, borderColor: "rgba(217,164,65,0.2)" }} />
        </>
      )}
      <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.gold }}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 39, color: colors.cream }}>{title}</Text>
      <Text style={{ fontSize: 16, lineHeight: 24, color: colors.creamMuted, maxWidth: 420 }}>{body}</Text>
      <View style={{ alignItems: "flex-start", marginTop: 6, marginBottom: art ? 46 : 0 }}>
        <Button title={cta} variant="gold" icon={icon} onPress={onPress} />
      </View>
    </View>
  );
}

/** The three steps a request goes through, small. It only describes what the app already does: nothing is booked or charged in the app. */
function Steps() {
  const steps = ["Send your request", "Maruf Cafe replies", "Confirm together"];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {steps.map((s, i) => (
          <View key={s} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }}><Text style={{ fontWeight: "800", color: colors.ink, fontSize: 15 }}>{i + 1}</Text></View>
            <Text style={{ fontSize: 13.5, lineHeight: 18, fontWeight: "700", color: colors.ink, textAlign: "center" }}>{s}</Text>
          </View>
        ))}
      </View>
      <Small style={{ textAlign: "center" }}>Nothing is booked until Maruf Cafe confirms it with you. No payment is taken in the app.</Small>
    </View>
  );
}

/** A small label, then a wrapping row of pills. */
function Pills({ title, items }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.goldText }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.map((u) => (
          <View key={u.title} style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.surface, borderRadius: 99, borderWidth: 1, borderColor: colors.line, paddingVertical: 8, paddingHorizontal: 13 }}>
            <Ionicons name={u.icon || "restaurant-outline"} size={16} color={colors.goldText} /><Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>{u.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FoodView() {
  const [planner, setPlanner] = useState(false);
  return (
    <>
      <GroupHero eyebrow="Large orders and catering" title="Food for your group" body="Tell us the date, how many people and what you'd like, and Maruf Cafe will get back to you with a quote."
        cta="Get a large order quote" onPress={() => router.push("/quote")} art={[ART.chicken, ART.bowl]} />
      <Steps />
      <Pills title="Good for" items={catering} />
      <Disclosure icon="calculator-outline" title="Not sure how much food?" hint="Try the group planner" open={planner} onToggle={setPlanner}>
        <Calculator bare />
      </Disclosure>
      <Photo slot="largeOrders" label="Food for a large order" ratio={1.8} />
    </>
  );
}

function RentView() {
  const { packages, packagesNote, venue } = useSite();
  const facts = [["Capacity", venue.capacity], ["About the space", venue.notes], ["Policies", venue.policies]].filter(([, v]) => v);
  return (
    <>
      <GroupHero eyebrow="Private events" title="Rent the café" body="Looking for a place in Staten Island for your next gathering? Maruf Cafe may be available for private events."
        cta="Check a date" icon="calendar-outline" onPress={() => router.push("/event-request")} />
      <Steps />
      <Pills title="Good for" items={venueUses} />
      <Photo slot="interior" label="Inside Maruf Cafe" ratio={1.8} />
      <Photo slot="event" label="An event at Maruf Cafe" ratio={1.8} onlyIfSet />
      {facts.length ? (
        <View style={{ gap: 10 }}>
          {facts.map(([k, v]) => <View key={k} style={{ gap: 2 }}><Small style={{ fontWeight: "800", color: colors.ink }}>{k}</Small><Body>{v}</Body></View>)}
        </View>
      ) : null}
      {packages.length ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.goldText }}>Options</Text>
          {packages.map((p) => (
            <Disclosure key={p.id} title={p.title} hint={p.blurb}>
              {(p.includes || []).length ? (
                <View style={{ gap: 7 }}>
                  {p.includes.map((x) => <View key={x} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}><Ionicons name="checkmark-circle" size={19} color={colors.gold} style={{ marginTop: 1 }} /><Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink }}>{x}</Text></View>)}
                </View>
              ) : null}
              {p.price ? <Text style={{ fontWeight: "800", color: colors.goldText, fontSize: 17 }}>{p.price}</Text> : null}
              <View style={{ alignItems: "flex-start" }}><Button title="Ask about this" variant="outline" size="medium" onPress={() => router.push({ pathname: "/event-request", params: { package: p.title } })} /></View>
            </Disclosure>
          ))}
          {packagesNote ? <Small>{packagesNote}</Small> : null}
        </View>
      ) : null}
    </>
  );
}

/** Large orders, catering and renting the café, together: they are the same kind of job (a request for a group) and share one place. */
export default function Groups() {
  const { show, n } = useLocalSearchParams();   // Home's tiles can open this on one part
  const [view, setView] = useState(show === "rent" ? "rent" : "food");
  useEffect(() => { if (show === "rent" || show === "food") setView(show); }, [show, n]);
  return (
    <Screen>
      <Reveal style={{ marginTop: 16, gap: 6 }}>
        <H1 style={{ fontSize: 38, lineHeight: 44 }}>Groups</H1>
        <Body>Feeding a crowd, or hosting one? Pick what you need.</Body>
      </Reveal>
      <View style={{ marginTop: 18, gap: 22 }}>
        <SegmentedTabs label="What do you need?" options={VIEWS} value={view} onChange={setView} />
        {view === "rent" ? <RentView /> : <FoodView />}
      </View>
    </Screen>
  );
}
