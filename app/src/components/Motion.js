import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Text, View } from "react-native";
import { countAt } from "../lib/motion-util";
import { colors } from "../theme";

// The small moving parts the app is built from: a number that counts up, a bar that fills, a glow, a pop, a burst of sparkles.
// All of them stand still for people who asked their phone (or browser) for less motion, and none of them ever takes a tap.

const native = Platform.OS !== "web";
let reduce = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce = !!r; }).catch(() => {});
try { AccessibilityInfo.addEventListener?.("reduceMotionChanged", (r) => { reduce = !!r; }); } catch { /* no listener here */ }
/** True when the person asked for less motion. */
export const motionOff = () => reduce;

/** A whole number that counts up (or down) to its new value, as text. Put it inside a Text: <Text><CountUp value={points} /> points</Text>. */
export function CountUp({ value, duration = 800, style }) {
  const target = Number.isFinite(value) ? Math.round(value) : 0;
  const [shown, setShown] = useState(0);
  const at = useRef(0);   // the number on screen right now
  useEffect(() => {
    if (reduce || at.current === target) { at.current = target; setShown(target); return undefined; }
    const from = at.current, t = new Animated.Value(0);
    const id = t.addListener(({ value: v }) => { at.current = countAt(from, target, v); setShown(at.current); });
    const run = Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false });
    run.start(({ finished }) => { if (finished) { at.current = target; setShown(target); } });
    return () => { run.stop(); t.removeListener(id); };
  }, [target, duration]);
  return <Text style={style}>{shown}</Text>;
}

/** A bar that fills to `pct` (0 to 1) when it appears and again whenever it changes. */
export function AnimatedFill({ pct, color, height = 10, track, delay = 0, style, duration = 700 }) {
  const goal = Math.min(1, Math.max(0, Number.isFinite(pct) ? pct : 0));
  const v = useRef(new Animated.Value(reduce ? goal : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(goal); return undefined; }
    const run = Animated.timing(v, { toValue: goal, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [goal, v, delay, duration]);
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: track || colors.line, overflow: "hidden" }, style]}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color || colors.gold, width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

/** A soft gold ring around something that is waiting to be used (a reward you can claim). Breathes slowly; still when motion is off. */
export function Glow({ active = true, radius = 16, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduce) { v.setValue(active ? 0.7 : 0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0.25, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return (
    <View style={style}>
      {children}
      {active ? <Animated.View pointerEvents="none" accessible={false} style={{ position: "absolute", left: -2, right: -2, top: -2, bottom: -2, borderRadius: radius + 2, borderWidth: 2, borderColor: colors.gold, opacity: v }} /> : null}
    </View>
  );
}

/** Whatever is inside gives a little bounce each time `trigger` changes (not when it first appears). */
export function Pop({ trigger, children, style, size = 1.22 }) {
  const v = useRef(new Animated.Value(1)).current, first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    v.setValue(size);
    Animated.spring(v, { toValue: 1, friction: 4, tension: 190, useNativeDriver: native }).start();
  }, [trigger, v, size]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/** Little dots that fly out from the middle and fade, once each time `play` goes up. Draws over its parent and never takes a tap. */
export function Burst({ play = 0, count = 8, radius = 30, size = 6, colorList }) {
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2 + 0.3, v: new Animated.Value(0), s: size - (i % 2) * 2 })), [count, size]);
  useEffect(() => {
    if (!play || reduce) return undefined;
    dots.forEach((d) => d.v.setValue(0));
    const run = Animated.parallel(dots.map((d) => Animated.timing(d.v, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: native })));
    run.start();
    return () => run.stop();
  }, [play, dots]);
  if (!play) return null;
  const palette = colorList || [colors.gold, colors.goldDeep, colors.danger, "#E8C46A"];
  return (
    <View pointerEvents="none" accessible={false} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ position: "absolute", width: d.s, height: d.s, borderRadius: d.s / 2, backgroundColor: palette[i % palette.length],
          opacity: d.v.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
          transform: [{ translateX: d.v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(d.a) * radius] }) }, { translateY: d.v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(d.a) * radius] }) }, { scale: d.v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }] }} />
      ))}
    </View>
  );
}

/** On the web, a button or tile springs back when let go (a CSS transition). On a phone this does nothing, because the press feedback there is already built in. */
export const springy = Platform.OS === "web" ? { transitionProperty: "transform, opacity", transitionDuration: "180ms", transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" } : null;
