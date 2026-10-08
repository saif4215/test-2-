import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadow } from "../theme";
import { priceText, useOrder } from "../lib/order";

/** The round "+" that becomes a quantity stepper once the item is in the basket. */
export function AddButton({ item, style }) {
  const order = useOrder();
  const qty = order.lines[item.id] || 0;
  if (!qty) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${item.name} to basket`} onPress={() => order.change(item.id, +1)}
        style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, shadow, style]}>
        <Ionicons name="add" size={24} color={colors.ink} />
      </Pressable>
    );
  }
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 20, height: 40 }, shadow, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${item.name}`} onPress={() => order.change(item.id, -1)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="remove" size={20} color={colors.ink} />
      </Pressable>
      <Text accessibilityLabel={`${qty} in basket`} style={{ minWidth: 18, textAlign: "center", fontWeight: "800", fontSize: 15, color: colors.ink }}>{qty}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add one more ${item.name}`} onPress={() => order.change(item.id, +1)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="add" size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const Thumb = ({ size, radius = 12, name, children }) => (
  <View accessibilityLabel={`Photo placeholder: ${name}`} style={{ width: size.w, height: size.h, borderRadius: radius, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
    <Ionicons name="image-outline" size={26} color={colors.faint} />
    {children}
  </View>
);

/** Menu row: text on the left, photo with the add button on the right. */
export function ItemRow({ item }) {
  return (
    <View style={{ flexDirection: "row", gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1, gap: 4, paddingTop: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{item.name}</Text>
        <Text style={{ fontSize: 15, color: colors.ink }}>{priceText(item)}</Text>
        {item.desc ? <Text numberOfLines={2} style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>{item.desc}</Text> : null}
        {item.cents == null ? <Text style={{ fontSize: 13, color: colors.muted }}>More than one size</Text> : null}
      </View>
      <View style={{ width: 104, height: 104 }}>
        <Thumb size={{ w: 104, h: 104 }} name={item.name} />
        <AddButton item={item} style={{ position: "absolute", right: 6, bottom: 6 }} />
      </View>
    </View>
  );
}

/** Carousel card: photo with the add button on top, then price and name. */
export function ItemCard({ item, width = 152 }) {
  return (
    <View style={{ width, gap: 8 }}>
      <View style={{ width, height: width * 0.78 }}>
        <Thumb size={{ w: width, h: width * 0.78 }} radius={14} name={item.name} />
        <AddButton item={item} style={{ position: "absolute", right: 8, bottom: 8 }} />
      </View>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>{item.name}</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>{priceText(item)}</Text>
      </View>
    </View>
  );
}
