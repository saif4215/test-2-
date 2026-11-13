import { Appearance, Platform } from "react-native";

// Warm palette taken from the Maruf logo (black and gold) on a warm white ground.
const light = {
  bg: "#FBF8F2", surface: "#FFFFFF", tint: "#F3EBDC", line: "#ECE3D4", outline: "#CDBFAB",
  ink: "#1B1511", muted: "#6B6158", placeholder: "#9A9087",
  gold: "#D9A441",        // fills and accents
  goldDeep: "#B9821F",    // pressed gold, icons on cream
  goldSoft: "#F7ECD1",    // pale gold wash behind icons and active tabs
  goldText: "#8A5F1B",    // gold used for text on light backgrounds (passes contrast)
  espresso: "#241A12", espressoLift: "#3A2A1C", cream: "#F6F1E7", creamMuted: "#D9CFBF",
  danger: "#B3261E", dangerSoft: "#FBEAE8", success: "#2E7D4F", successSoft: "#DDF0E4",
  onGold: "#1B1511",      // text and icons on gold: dark in both looks
  onDark: "#F6F1E7", onDarkMuted: "#D9CFBF",   // text on the dark brown cards: light in both looks
};

// The dark look: the same warm browns, turned around. `ink` is the main text colour and `cream` is the text that sits ON ink (buttons, the chosen chip), so both swap.
const dark = {
  bg: "#14100C", surface: "#1F1913", tint: "#2A2118", line: "#392E22", outline: "#5A4B3A",
  ink: "#F3EBDD", muted: "#B5A998", placeholder: "#8F8372",
  gold: "#D9A441", goldDeep: "#B9821F", goldSoft: "#3A2C14", goldText: "#E5B960",
  espresso: "#241A12", espressoLift: "#3A2A1C", cream: "#1B1511", creamMuted: "#3A2F23",
  danger: "#F0867C", dangerSoft: "#3B1F1C", success: "#6FCB97", successSoft: "#1C3326",
  onGold: "#1B1511", onDark: "#F6F1E7", onDarkMuted: "#D9CFBF",
};

/** The colours in use. One shared object: switching the look changes its values in place, and screens read them as they draw. */
export const colors = { ...light };
let scheme = "light";
export const isDark = () => scheme === "dark";

/** Switch the look ("light" or "dark"). Returns true when it changed. */
export function applyScheme(name) {
  const next = name === "dark" ? "dark" : "light";
  if (next === scheme) return false;
  Object.assign(colors, next === "dark" ? dark : light);
  scheme = next;
  return true;
}
// Start in the look the phone is in, so the first screen is already right.
try { applyScheme(Appearance.getColorScheme()); } catch { /* no appearance: stay light */ }

export const radius = { card: 22, button: 16, chip: 999, field: 14, hero: 30, image: 18 };

// The display face is DM Serif Display (assets/fonts, loaded in the root layout). On the web the stack falls back to Georgia
// until it has loaded; on phones the root layout waits for it.
export const fonts = {
  display: Platform.OS === "web" ? "DMSerifDisplay, Georgia, 'Times New Roman', serif" : "DMSerifDisplay",
};

// Soft, warm shadows (React Native 0.76+ draws boxShadow on phones too; the web uses it directly).
export const shadow = { boxShadow: "0px 1px 2px rgba(36,26,18,0.06), 0px 8px 24px rgba(36,26,18,0.07)" };
export const shadowStrong = { boxShadow: "0px 2px 4px rgba(36,26,18,0.10), 0px 16px 36px rgba(36,26,18,0.18)" };

/** A linear gradient as a style. The base colour is the fallback if a platform ignores gradients. */
export function gradient(base, css) {
  return Platform.OS === "web" ? { backgroundColor: base, backgroundImage: css } : { backgroundColor: base, experimental_backgroundImage: css };
}

// Text styles are read each time they are used (getters), so they follow the look.
export const text = {
  get display() { return { fontFamily: fonts.display, fontWeight: "400", fontSize: 40, lineHeight: 44, letterSpacing: -0.4, color: colors.ink }; },
  get h1() { return { fontFamily: fonts.display, fontWeight: "400", fontSize: 31, lineHeight: 37, letterSpacing: -0.2, color: colors.ink }; },
  get h2() { return { fontFamily: fonts.display, fontWeight: "400", fontSize: 24, lineHeight: 30, color: colors.ink }; },
  get h3() { return { fontSize: 17, lineHeight: 23, fontWeight: "700", color: colors.ink }; },
  get body() { return { fontSize: 16, lineHeight: 25, color: colors.muted }; },
  get small() { return { fontSize: 14, lineHeight: 20, color: colors.muted }; },
  get eyebrow() { return { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase", color: colors.goldText }; },
};
