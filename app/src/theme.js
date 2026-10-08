import { Platform } from "react-native";

// Clean delivery-app look: white, black text, grey chips, one green accent.
export const colors = {
  bg: "#FFFFFF", surface: "#FFFFFF", tint: "#F3F3F3", line: "#E6E6E6",
  ink: "#000000", muted: "#5E5E5E", faint: "#8A8A8A",
  accent: "#06C167",       // fills (always with black text on top)
  accentText: "#048848",   // green used for text on white
  gold: "#D9A441",         // Maruf gold, used on promo cards
  cream: "#FFFFFF", danger: "#D3200C", success: "#048848",
  promoBlack: "#000000", promoGold: "#F3D48A", promoGreen: "#06C167", promoGrey: "#EEEEEE",
};

export const radius = { card: 14, button: 14, chip: 999, field: 12 };

export const shadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 3 },
  default: { boxShadow: "0 2px 8px rgba(0, 0, 0, 0.16)" },
});

export const text = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.8, color: colors.ink },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6, color: colors.ink },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.4, color: colors.ink },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", color: colors.accentText },
};
