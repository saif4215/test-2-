import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View, useWindowDimensions } from "react-native";
import { colors } from "../theme";

const PIECES = 30, COLORS = [colors.gold, colors.goldDeep, colors.success, colors.cream, "#E8C46A", colors.espressoLift];

/**
 * A short burst of confetti, once each time `play` goes up (play={1} on first show, 2 for the next moment, and so on).
 * Draws over the top of the screen, never blocks a tap, and does nothing for people who asked for less motion.
 */
export function Celebrate({ play = 0 }) {
  const { width } = useWindowDimensions();
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => ({
    x: ((i * 37) % 100) / 100, size: 7 + (i % 4) * 3, color: COLORS[i % COLORS.length], delay: (i * 53) % 420, drift: ((i % 7) - 3) * 14, spin: (i % 2 ? 1 : -1) * (180 + (i % 5) * 90),
    v: new Animated.Value(0),
  })), []);
  const reduce = useRef(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce.current = !!r; }).catch(() => {}); }, []);
  useEffect(() => {
    if (!play || reduce.current) return undefined;
    pieces.forEach((p) => p.v.setValue(0));
    const run = Animated.parallel(pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: 1500 + (p.delay % 300), delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true })));
    run.start();
    return () => run.stop();
  }, [play, pieces]);
  if (!play) return null;
  return (
    <View accessible={false} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 620, overflow: "hidden" }}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: "absolute", left: p.x * Math.max(0, width - 40), top: -20, width: p.size, height: p.size * 1.6, borderRadius: 2, backgroundColor: p.color,
          opacity: p.v.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, 560] }) }, { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift * 3] }) }, { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) }],
        }} />
      ))}
    </View>
  );
}
