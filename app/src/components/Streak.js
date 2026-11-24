import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Small } from "./ui";
import { CountUp, motionOff } from "./Motion";
import { useMemory } from "../lib/memory";
import { streakLine, weekStreak } from "../lib/perks-util";
import { colors, fonts } from "../theme";

const native = Platform.OS !== "web";
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"], NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The flame: flickers gently while the streak is alive and this week has an order; sits still and dim when the streak needs an order to stay alive. */
function Flame({ lit }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lit || motionOff()) { v.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration: 640, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [lit, v]);
  return (
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: lit ? colors.goldSoft : colors.tint, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-4deg", "5deg"] }) }] }}>
        <Ionicons name="flame" size={30} color={lit ? colors.goldDeep : colors.muted} />
      </Animated.View>
    </View>
  );
}

/** One day of the week: fills in with a little pop (one after another) when the week has an order that day. */
function Day({ letter, name, done, today, i }) {
  const v = useRef(new Animated.Value(motionOff() || !done ? 1 : 0)).current;
  useEffect(() => {
    if (!done || motionOff()) { v.setValue(1); return undefined; }
    v.setValue(0);
    const run = Animated.spring(v, { toValue: 1, delay: 250 + i * 70, friction: 5, tension: 160, useNativeDriver: native });
    run.start();
    return () => run.stop();
  }, [done, i, v]);
  return (
    <View accessible accessibilityLabel={`${name}${today ? ", today" : ""}: ${done ? "you ordered" : "no order"}`} style={{ alignItems: "center", gap: 5, flex: 1 }}>
      <Animated.View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: done ? colors.gold : "transparent", borderWidth: done ? 0 : 1.5, borderColor: today ? colors.goldDeep : colors.line, transform: [{ scale: v }] }}>
        {done ? <Ionicons name="checkmark" size={17} color={colors.onGold} /> : null}
      </Animated.View>
      <Text style={{ fontSize: 12, fontWeight: today ? "800" : "600", color: today ? colors.ink : colors.muted }}>{letter}</Text>
    </View>
  );
}

/** Home: how many weeks in a row there has been an order, with this week's days. Nothing shows until the first order is in the app's history. It promises no prize: it is only a streak. */
export function StreakCard({ style, now }) {
  const { history } = useMemory();
  const s = useMemo(() => weekStreak(history, now), [history, now]);
  if (!s.alive) return null;
  const today = (new Date(now || Date.now()).getDay() + 6) % 7;
  return (
    <Card style={[{ padding: 16, gap: 14 }, style]}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <Flame lit={s.thisWeek} />
        <View accessible accessibilityLabel={`${s.weeks} ${s.weeks === 1 ? "week" : "weeks"} in a row. ${streakLine(s)}`} style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink }}><CountUp value={s.weeks} duration={600} /> {s.weeks === 1 ? "week" : "weeks"} in a row</Text>
          <Small style={{ color: s.thisWeek ? colors.muted : colors.goldText, fontWeight: s.thisWeek ? "400" : "700" }}>{streakLine(s)}</Small>
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        {LETTERS.map((l, i) => <Day key={i} i={i} letter={l} name={NAMES[i]} done={s.days[i]} today={i === today} />)}
      </View>
    </Card>
  );
}
