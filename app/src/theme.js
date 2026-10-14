import { Platform } from "react-native";

// Warm palette taken from the Maruf logo (black and gold) on a warm white ground.
export const colors = {
  bg: "#FBF8F2", surface: "#FFFFFF", tint: "#F3EBDC", line: "#ECE3D4",
  ink: "#1B1511", muted: "#6B6158",
  gold: "#D9A441",        // fills and accents
  goldDeep: "#B9821F",    // pressed gold, icons on cream
  goldSoft: "#F7ECD1",    // pale gold wash behind icons and active tabs
  goldText: "#8A5F1B",    // gold used for text on light backgrounds (passes contrast)
  espresso: "#241A12", espressoLift: "#3A2A1C", cream: "#F6F1E7", creamMuted: "#D9CFBF",
  danger: "#B3261E", success: "#2E7D4F", successSoft: "#DDF0E4",
};

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

export const text = {
  display: { fontFamily: fonts.display, fontWeight: "400", fontSize: 40, lineHeight: 44, letterSpacing: -0.4, color: colors.ink },
  h1: { fontFamily: fonts.display, fontWeight: "400", fontSize: 31, lineHeight: 37, letterSpacing: -0.2, color: colors.ink },
  h2: { fontFamily: fonts.display, fontWeight: "400", fontSize: 24, lineHeight: 30, color: colors.ink },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 25, color: colors.muted },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase", color: colors.goldText },
};
