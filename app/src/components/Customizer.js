import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Chip, Small } from "./ui";
import { controlsFor, describeCustom, EMPTY, isShown } from "../lib/customize";
import { useOrder } from "../lib/order";
import { colors, fonts, radius, shadow } from "../theme";

const label = { fontSize: 15, fontWeight: "800", color: colors.ink };

/** Two or three choices side by side, one can be on. Tapping the chosen one again clears it. */
function Segmented({ options, value, onChange, name }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={name} style={{ flexDirection: "row", backgroundColor: colors.tint, borderRadius: 16, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable key={o} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${name}: ${o}`} onPress={() => onChange(on ? "" : o)}
            style={[{ flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }, on ? [{ backgroundColor: colors.ink }, { boxShadow: "0px 4px 10px rgba(27,21,17,0.22)" }] : null]}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "800", color: on ? colors.cream : colors.ink }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A count with minus and plus buttons: "Standard" at zero, then "2 shots". */
function Stepper({ value, max, unit, onChange, name }) {
  const round = (disabled) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, opacity: disabled ? 0.4 : 1 });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 22, fontFamily: fonts.display, color: colors.ink }}>{value ? `${value} ${unit}${value === 1 ? "" : "s"}` : "Standard"}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${unit}s of ${name}`} disabled={value <= 0} onPress={() => onChange(value - 1)} style={round(value <= 0)}><Ionicons name="remove" size={22} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`More ${unit}s of ${name}`} disabled={value >= max} onPress={() => onChange(value + 1)} style={[round(value >= max), value < max ? { backgroundColor: colors.gold, borderColor: colors.gold } : null]}><Ionicons name="add" size={22} color={colors.ink} /></Pressable>
      </View>
    </View>
  );
}

function Panel({ title, value, children }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: "rgba(36,26,18,0.06)", padding: 16, gap: 12 }, shadow]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Text style={label}>{title}</Text>
        {value ? <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.goldText, flexShrink: 1 }}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * "Make it your way" for a drink: size, hot or iced, espresso shots, pumps of syrup, milk, ice, sweetness and extras, as large buttons.
 * Everything is optional and is a request that goes with the quote request; nothing changes the price here.
 */
export function Customizer({ item }) {
  const order = useOrder();
  const controls = controlsFor(item);
  if (!controls.length) return null;
  const c = { ...EMPTY, ...(order.custom[item.id] || {}) };
  const set = (patch) => order.setCustom(item.id, patch);
  const summary = describeCustom(c, controls);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink }}>Make it your way</Text>
        {summary ? <Pressable accessibilityRole="button" accessibilityLabel="Clear my choices" onPress={() => order.resetCustom(item.id)} hitSlop={8}><Text style={{ color: colors.goldText, fontWeight: "800", fontSize: 15 }}>Clear</Text></Pressable> : null}
      </View>
      <Small>Everything is optional. These are requests: Maruf Cafe confirms what it can make and whether anything costs extra.</Small>
      {summary ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.goldSoft, borderRadius: 18, padding: 14 }}>
          <Ionicons name="sparkles" size={20} color={colors.goldText} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}><Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", color: colors.goldText }}>Your drink</Text><Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "700", color: colors.ink }}>{summary}</Text></View>
        </View>
      ) : null}
      {controls.filter((ctl) => isShown(ctl, c)).map((ctl) => {
        if (ctl.id === "size" || ctl.id === "temp") {
          return <Panel key={ctl.id} title={ctl.label} value={c[ctl.id]}><Segmented name={ctl.label} options={ctl.options} value={c[ctl.id]} onChange={(v) => set({ [ctl.id]: v })} /></Panel>;
        }
        if (ctl.id === "shots") {
          return <Panel key={ctl.id} title={ctl.label} value={c.shots ? `${c.shots}` : ""}><Stepper name="espresso" value={c.shots} max={ctl.max} unit={ctl.unit} onChange={(v) => set({ shots: v })} /></Panel>;
        }
        if (ctl.id === "syrup") {
          return (
            <Panel key={ctl.id} title={ctl.label} value={c.pumps ? `${c.pumps} ${c.flavor || "syrup"}` : ""}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ctl.options.map((o) => <Chip key={o} small label={o} active={c.flavor === o} onPress={() => set({ flavor: c.flavor === o ? "" : o })} />)}
              </View>
              <Stepper name="syrup" value={c.pumps} max={ctl.max} unit={ctl.unit} onChange={(v) => set({ pumps: v })} />
            </Panel>
          );
        }
        if (ctl.multi) {
          return (
            <Panel key={ctl.id} title={ctl.label} value={c.extras.join(", ")}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ctl.options.map((o) => <Chip key={o} small label={o} active={c.extras.includes(o)} onPress={() => set({ extras: c.extras.includes(o) ? c.extras.filter((x) => x !== o) : [...c.extras, o] })} />)}
              </View>
            </Panel>
          );
        }
        return (
          <Panel key={ctl.id} title={ctl.label} value={c[ctl.id]}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ctl.options.map((o) => <Chip key={o} small label={o} active={c[ctl.id] === o} onPress={() => set({ [ctl.id]: c[ctl.id] === o ? "" : o })} />)}
            </View>
          </Panel>
        );
      })}
    </View>
  );
}
