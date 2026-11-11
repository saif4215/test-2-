import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Chip, Disclosure, Small } from "./ui";
import { describeCustom, extraText, extrasCents, hasOffers, missingRequired, resolve } from "../lib/customize";
import { money, useOrder } from "../lib/order";
import { select } from "../lib/haptics";
import { colors, fonts, shadow } from "../theme";

const label = { fontSize: 15, fontWeight: "800", color: colors.ink };

/** The sizes side by side with their prices, one on at a time. */
function Sizes({ item, value, onChange }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Size" style={{ flexDirection: "row", backgroundColor: colors.tint, borderRadius: 16, padding: 4, gap: 4 }}>
      {item.sizes.map((s) => {
        const on = value === s.name;
        return (
          <Pressable key={s.name} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`Size: ${s.name}, ${money(s.cents)}`} onPress={() => { select(); onChange(s.name); }}
            style={[{ flex: 1, minHeight: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, gap: 1 }, on ? [{ backgroundColor: colors.ink }, { boxShadow: "0px 4px 10px rgba(27,21,17,0.22)" }] : null]}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "800", color: on ? colors.cream : colors.ink }}>{s.name}</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: on ? colors.cream : colors.muted }}>{money(s.cents)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Panel({ title, hint, needed, value, children, flat }) {
  return (
    <View style={flat ? { gap: 12, paddingTop: 14, borderTopWidth: 1, borderColor: colors.line } : { gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={label}>{title}</Text>
          {hint ? <Text style={{ fontSize: 13, color: needed ? colors.danger : colors.muted, fontWeight: needed ? "800" : "400" }}>{hint}</Text> : null}
        </View>
        {value ? <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.goldText, flexShrink: 1 }}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** One set of choices ("Alternative milk +$1.00", "Hot or iced"): chips, each with what it adds to the price. */
function ChoiceSet({ item, set, picked, onPick, flat, needed }) {
  const hint = set.kind === "many" ? (set.max && set.max < set.choices.length ? `Choose up to ${set.max}` : "Choose any") : set.required ? (needed ? "Required: please choose one" : "Required") : "Optional";
  return (
    <Panel flat={flat} title={set.label} hint={hint} needed={needed} value={picked.join(", ")}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {set.choices.map((c) => {
          const text = extraText(c.cents);
          return <Chip key={c.name} small label={text ? `${c.name} ${text}` : c.name} active={picked.includes(c.name)} onPress={() => { select(); onPick(set.id, c.name); }} />;
        })}
      </View>
    </Panel>
  );
}

/**
 * "Make it your way". The size (with its price) and the choices this item offers, all from the café's menu. Each choice shows what it adds,
 * and the price on the Add button follows. The size and the must-pick choices are up front; when there are several optional ones they are one tap away.
 */
export function Customizer({ item }) {
  const order = useOrder();
  if (!hasOffers(item)) return null;
  const custom = order.custom[item.id];
  const r = resolve(item, custom);
  const sets = item.optionSets || [];
  const upFront = sets.filter((s) => s.required || s.id === "temp"), rest = sets.filter((s) => !(s.required || s.id === "temp"));
  const folded = rest.length > 2;   // two or fewer optional sets are simply shown; more than that sit under "More options"
  const summary = describeCustom(item, custom), extra = extrasCents(item, custom);
  const touched = !!(custom && (custom.size || Object.values(custom.picks || {}).some((p) => p && p.length)));
  const missing = missingRequired(item, custom);
  const renderSet = (set, flat) => <ChoiceSet key={set.id} item={item} set={set} flat={flat} needed={missing.some((m) => m.id === set.id)} picked={r.picks[set.id] || []} onPick={(id, name) => order.choose(item, id, name)} />;
  const restSummary = rest.flatMap((s) => r.picks[s.id] || []).join(", ");

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink }}>Make it your way</Text>
        {touched ? <Pressable accessibilityRole="button" accessibilityLabel="Clear my choices" onPress={() => order.resetCustom(item.id)} hitSlop={8}><Text style={{ color: colors.goldText, fontWeight: "800", fontSize: 15 }}>Clear</Text></Pressable> : null}
      </View>
      {(item.sizes && item.sizes.length > 1) || upFront.length ? (
        <View style={[{ backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: "rgba(36,26,18,0.06)", padding: 16, gap: 18 }, shadow]}>
          {item.sizes && item.sizes.length > 1 ? <Panel title="Size" value={r.size}><Sizes item={item} value={r.size} onChange={(name) => order.chooseSize(item.id, name)} /></Panel> : null}
          {upFront.map((s) => renderSet(s, false))}
        </View>
      ) : null}
      {rest.length ? (folded ? (
        <Disclosure title="More options" hint={restSummary || rest.map((s) => s.label).join(", ")}>
          {rest.map((s) => renderSet(s, true))}
        </Disclosure>
      ) : (
        <View style={[{ backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: "rgba(36,26,18,0.06)", padding: 16, gap: 18 }, shadow]}>{rest.map((s) => renderSet(s, false))}</View>
      )) : null}
      {summary ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.goldSoft, borderRadius: 18, padding: 14 }}>
          <Ionicons name="sparkles" size={20} color={colors.goldText} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", color: colors.goldText }}>Your pick</Text>
            <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "700", color: colors.ink }}>{summary}{extra > 0 ? `  ·  ${extraText(extra)} extra` : ""}</Text>
          </View>
        </View>
      ) : null}
      <Small>Choices with a price are added to the price below. Maruf Cafe confirms your order when it accepts it.</Small>
    </View>
  );
}
