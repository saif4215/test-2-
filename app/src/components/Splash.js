import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, View } from "react-native";
import { colors } from "../theme";

const logo = require("../../assets/logo-light.png");

/** How long each part takes, in milliseconds. The whole opening is about a second so it never feels like waiting. */
export const SPLASH_TIMING = { logoIn: 380, hold: 330, out: 260 };
export const SPLASH_TOTAL = SPLASH_TIMING.logoIn + SPLASH_TIMING.hold + SPLASH_TIMING.out;

/**
 * The opening: the dark brown of the café's cups, the logo pops in with a gold ring that spreads out behind it, a short pause, then it lifts away.
 * It sits on top of the app while the app loads underneath (it never delays anything, and never takes a tap). People who asked their phone for less motion skip it.
 * On the web it plays once for each browser tab, not on every reload.
 */
export function Splash() {
  const [show, setShow] = useState(() => {
    if (Platform.OS !== "web") return true;
    try { if (window.sessionStorage.getItem("maruf:opened")) return false; window.sessionStorage.setItem("maruf:opened", "1"); } catch { /* no storage: play it */ }
    return true;
  });
  const pop = useRef(new Animated.Value(0)).current;     // the logo arriving
  const ring = useRef(new Animated.Value(0)).current;    // the gold ring spreading out
  const leave = useRef(new Animated.Value(0)).current;   // the whole thing lifting away
  useEffect(() => {
    if (!show) return undefined;
    let live = true;
    const native = Platform.OS !== "web";
    AccessibilityInfo.isReduceMotionEnabled?.().then((reduce) => { if (live && reduce) setShow(false); }).catch(() => {});
    const run = Animated.sequence([
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 6, tension: 140, useNativeDriver: native }),
        Animated.timing(ring, { toValue: 1, duration: SPLASH_TIMING.logoIn + SPLASH_TIMING.hold, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      ]),
      Animated.timing(leave, { toValue: 1, duration: SPLASH_TIMING.out, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
    ]);
    run.start(() => { if (live) setShow(false); });
    return () => { live = false; run.stop(); };
  }, [show, pop, ring, leave]);
  if (!show) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 999, backgroundColor: colors.espresso, alignItems: "center", justifyContent: "center",
        opacity: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: leave.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) }, { scale: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
      <Animated.View style={{ position: "absolute", width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: colors.gold,
        opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] }) }] }} />
      <Animated.View style={{ opacity: pop.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: "clamp" }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "0deg"] }) }] }}>
        <Image source={logo} accessible={false} resizeMode="contain" style={{ width: 190, height: 140 }} />
      </Animated.View>
    </Animated.View>
  );
}
