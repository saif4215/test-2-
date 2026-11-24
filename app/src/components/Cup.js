import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { motionOff } from "./Motion";
import { colors } from "../theme";

const native = Platform.OS !== "web";

/** A looping up-and-down (or fade) for one decoration, started after `delay`. Nothing moves when motion is off. */
function useLoop(active, { duration = 1600, delay = 0 } = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || motionOff()) { v.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, v, duration, delay]);
  return v;
}

/** One wisp of steam rising off a hot drink. */
function Wisp({ x, h, delay, on }) {
  const v = useLoop(on, { duration: 2000, delay });
  return <Animated.View style={{ position: "absolute", left: x, bottom: 0, width: 5, height: h, borderRadius: 3, backgroundColor: colors.muted, opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -h * 0.9] }) }, { scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }} />;
}

/** A bubble rising through the drink while it is being made. */
function Bubble({ x, delay, rise, on }) {
  const v = useLoop(on, { duration: 1500, delay });
  return <Animated.View style={{ position: "absolute", left: x, bottom: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.7)", opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) }] }} />;
}

/** An ice cube bobbing at the top of an iced drink. */
function Ice({ x, y, s, delay, on }) {
  const v = useLoop(on, { duration: 2200, delay });
  return <Animated.View style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: s * 0.25, backgroundColor: "rgba(255,255,255,0.42)", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", transform: [{ translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 3, 0] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] }) }] }} />;
}

/**
 * A clear cup drawn with plain boxes. `level` (0 to 1) is how full it is and eases to each new level; `tint` is the drink's colour.
 * It can show steam (hot and ready), bubbles (being made) or ice and a straw (`iced`), and it gives a little bounce each time `bounceKey` changes.
 * `size` is the cup's height in pixels; the picture is wider than the cup by the steam above it. Only a picture: it has no meaning for screen readers.
 */
export function Cup({ level = 0.5, size = 120, scale = 1, tint = "#7A4A2A", steam = false, bubbles = false, iced = false, dim = false, bounceKey }) {
  const H = Math.round(size * scale), W = Math.round(H * 0.62), lidH = Math.max(6, Math.round(H * 0.1)), body = H - lidH;
  const fill = useRef(new Animated.Value(motionOff() ? level : 0)).current, bounce = useRef(new Animated.Value(1)).current, firstBounce = useRef(true);
  useEffect(() => {
    if (motionOff()) { fill.setValue(level); return undefined; }
    const run = Animated.spring(fill, { toValue: level, friction: 7, tension: 60, useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [level, fill]);
  useEffect(() => {
    if (firstBounce.current) { firstBounce.current = false; return; }
    if (motionOff()) return;
    bounce.setValue(0.9);
    Animated.spring(bounce, { toValue: 1, friction: 4, tension: 170, useNativeDriver: native }).start();
  }, [bounceKey, bounce]);
  const ice = useMemo(() => [[0.12, 0.04, 0.2, 0], [0.5, 0.0, 0.22, 500], [0.3, 0.14, 0.17, 900]], []);
  const glass = dim ? colors.line : tint;
  const reservedTop = Math.round(H * 0.34);   // room above the lid for steam and the straw
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" dataSet={{ cup: "1", level: String(level), steam: steam ? "1" : "0", bubbles: bubbles ? "1" : "0", iced: iced ? "1" : "0" }} style={{ width: Math.round(W * 1.5), height: H + reservedTop, alignItems: "center", justifyContent: "flex-end" }}>
      <Animated.View style={{ width: Math.round(W * 1.1), alignItems: "center", opacity: dim ? 0.55 : 1, transform: [{ scale: bounce }] }}>
        <View style={{ width: Math.round(W * 0.6), height: reservedTop, alignSelf: "center" }}>
          {steam ? [[0.05, 0.7, 0], [0.42, 0.9, 500], [0.78, 0.65, 1000]].map(([f, k, d], i) => <Wisp key={i} on x={Math.round(W * 0.6 * f)} h={Math.round(reservedTop * k)} delay={d} />) : null}
          {iced ? <View style={{ position: "absolute", left: "58%", bottom: 0, width: 5, height: reservedTop + 6, borderRadius: 3, backgroundColor: colors.gold, transform: [{ rotate: "9deg" }] }} /> : null}
        </View>
        <View style={{ width: Math.round(W * 1.1), height: lidH, borderRadius: lidH / 2, backgroundColor: colors.ink }} />
        <View style={{ width: W, height: body, borderBottomLeftRadius: Math.round(W * 0.2), borderBottomRightRadius: Math.round(W * 0.2), borderWidth: 2, borderTopWidth: 0, borderColor: colors.outline, backgroundColor: colors.tint, overflow: "hidden", justifyContent: "flex-end" }}>
          <Animated.View style={{ width: "100%", backgroundColor: glass, height: fill.interpolate({ inputRange: [0, 1], outputRange: [0, body - 4] }) }}>
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 4, backgroundColor: "rgba(255,255,255,0.35)" }} />
            {bubbles ? [[0.2, 0, 0.5], [0.52, 450, 0.7], [0.74, 900, 0.4]].map(([f, d, r], i) => <Bubble key={i} on x={Math.round(W * f)} delay={d} rise={Math.max(10, Math.round(body * 0.5 * r))} />) : null}
            {iced ? ice.map(([fx, fy, fs, d], i) => <Ice key={i} on x={Math.round(W * fx)} y={Math.round(body * fy)} s={Math.round(W * fs)} delay={d} />) : null}
          </Animated.View>
          <View style={{ position: "absolute", left: Math.round(W * 0.14), top: Math.round(body * 0.08), width: 4, height: Math.round(body * 0.5), borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" }} />
        </View>
      </Animated.View>
    </View>
  );
}
