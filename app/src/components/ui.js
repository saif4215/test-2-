import { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, text } from "../theme";
import { photos } from "../photos";
import { showPlaceholders } from "../config";
import { useSite } from "../lib/site";

/** Scrolling screen with a centred, readable column on tablets and the web. */
export function Screen({ children, bottomPad = 120 }) {
  const { width } = useWindowDimensions();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ alignItems: "center", paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
      <View style={{ width: "100%", maxWidth: 980, paddingHorizontal: width >= 768 ? 32 : 20, paddingTop: 8 }}>{children}</View>
    </ScrollView>
  );
}

export const Eyebrow = ({ children, style }) => <Text style={[text.eyebrow, style]}>{children}</Text>;
export const Display = ({ children, style }) => <Text accessibilityRole="header" style={[text.display, style]}>{children}</Text>;
export const H1 = ({ children, style }) => <Text accessibilityRole="header" style={[text.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }) => <Text accessibilityRole="header" style={[text.h2, style]}>{children}</Text>;
export const H3 = ({ children, style }) => <Text style={[text.h3, style]}>{children}</Text>;
export const Body = ({ children, style }) => <Text style={[text.body, style]}>{children}</Text>;
export const Small = ({ children, style }) => <Text style={[text.small, style]}>{children}</Text>;

/** A page section with generous whitespace above it. */
export function Section({ children, style, tone }) {
  return <View style={[{ marginTop: 44 }, tone === "dark" && { backgroundColor: colors.espresso, borderRadius: radius.card, padding: 24 }, style]}>{children}</View>;
}

const variants = {
  primary: { bg: colors.ink, fg: colors.cream, border: colors.ink },
  gold: { bg: colors.gold, fg: colors.ink, border: colors.gold },
  outline: { bg: "transparent", fg: colors.ink, border: colors.ink },
  light: { bg: colors.surface, fg: colors.ink, border: colors.line },
};

export function Button({ title, onPress, variant = "primary", size = "large", icon, disabled, style, accessibilityLabel }) {
  const v = variants[variant];
  const big = size === "large";
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed, hovered }) => [{
        backgroundColor: v.bg, borderColor: v.border, borderWidth: 1.5, borderRadius: radius.button,
        paddingVertical: big ? 18 : 11, paddingHorizontal: big ? 24 : 16, minHeight: big ? 56 : 44,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        opacity: disabled ? 0.5 : pressed ? 0.85 : hovered ? 0.93 : 1, transform: [{ scale: pressed ? 0.985 : 1 }],
      }, style]}
    >
      {icon ? <Ionicons name={icon} size={big ? 20 : 17} color={v.fg} /> : null}
      <Text style={{ color: v.fg, fontSize: big ? 15 : 14, fontWeight: "800", letterSpacing: big ? 1.1 : 0.6, textTransform: "uppercase", textAlign: "center", flexShrink: 1 }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress, label }) {
  const base = [{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }, shadow, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9 }]}>{children}</Pressable>;
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
      style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.chip, borderWidth: 1.5, borderColor: active ? colors.ink : colors.line, backgroundColor: active ? colors.ink : colors.surface, minHeight: 44, justifyContent: "center" }}>
      <Text style={{ color: active ? colors.cream : colors.ink, fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Wrapping grid: 1 column on phones, 2 on tablets, 3 on wide screens. */
export function Grid({ children, min = 280, gap = 16, style }) {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 980) - (width >= 768 ? 64 : 40);
  const cols = Math.max(1, Math.min(3, Math.floor((inner + gap) / (min + gap))));
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : [children];
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap }, style]}>
      {items.map((c, i) => <View key={i} style={{ width: cols === 1 ? "100%" : (inner - gap * (cols - 1)) / cols }}>{c}</View>)}
    </View>
  );
}

/** A photo slot. Shows the photo from photos.js, or a tidy placeholder until one is added. */
export function Photo({ slot, label, ratio = 1.6, style, radiusSize = radius.card }) {
  const { photos: remote } = useSite();
  const source = photos[slot] || (remote[slot] ? { uri: remote[slot] } : null);   // a photo built into the app wins, then one uploaded in the dashboard
  const { width } = useWindowDimensions();
  const box = { width: "100%", aspectRatio: width >= 768 ? ratio * 1.6 : ratio, borderRadius: radiusSize, overflow: "hidden" };
  if (source) return <Image source={source} accessibilityLabel={label} resizeMode="cover" style={[box, style]} />;
  if (!showPlaceholders) return null;   // store builds show nothing rather than a placeholder
  return (
    <View accessibilityLabel={`Photo placeholder: ${label}`} style={[box, { backgroundColor: colors.tint, alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed" }, style]}>
      <Ionicons name="image-outline" size={30} color={colors.goldText} />
      <Text style={{ color: colors.goldText, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textAlign: "center", paddingHorizontal: 12 }}>{label}</Text>
    </View>
  );
}

export function IconBadge({ name, size = 22 }) {
  return (
    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={name} size={size} color={colors.goldText} />
    </View>
  );
}

/* ----------------------------------------------------------------------- form fields */

export function Field({ label, value, onChangeText, error, hint, required, multiline, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>{label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} multiline={multiline} accessibilityLabel={label}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholderTextColor="#9A9087"
        style={{ backgroundColor: colors.surface, borderRadius: radius.field, borderWidth: 1.5, borderColor: error ? colors.danger : focus ? colors.ink : colors.line, paddingHorizontal: 14, paddingVertical: 13, minHeight: multiline ? 104 : 50, textAlignVertical: multiline ? "top" : "center", fontSize: 16, color: colors.ink, outlineStyle: "none" }}
        {...props}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : hint ? <Text style={{ color: colors.muted, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

export function Choice({ label, options, value, onChange, error, required }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>{label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(value === o.value && !required ? "" : o.value)} />)}
      </View>
      {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export const FormGroup = ({ title, children }) => (
  <View style={{ gap: 16 }}>
    <Text style={[text.eyebrow, { marginTop: 8 }]}>{title}</Text>
    {children}
  </View>
);
