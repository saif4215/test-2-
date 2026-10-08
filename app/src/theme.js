import { Platform } from "react-native";

// Warm light palette taken from the Maruf logo (black and gold) on a warm white ground.
export const colors = {
  bg: "#FBF8F2", surface: "#FFFFFF", tint: "#F1E8D8", line: "#E8DFD0",
  ink: "#1B1511", muted: "#675E55",
  gold: "#D9A441",        // fills and accents
  goldText: "#8A5F1B",    // gold used for text on light backgrounds (passes contrast)
  espresso: "#241A12", cream: "#F6F1E7",
  danger: "#B3261E", success: "#2E7D4F",
};

export const radius = { card: 22, button: 16, chip: 999, field: 14 };

export const shadow = Platform.select({
  ios: { shadowColor: "#241A12", shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 3 },
  default: { boxShadow: "0 8px 24px rgba(36, 26, 18, 0.09)" },
});

export const text = {
  display: { fontSize: 38, lineHeight: 44, fontWeight: "800", letterSpacing: -0.8, color: colors.ink },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5, color: colors.ink },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.2, color: colors.ink },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase", color: colors.goldText },
};
