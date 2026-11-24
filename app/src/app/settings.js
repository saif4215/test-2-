import { useState } from "react";
import { Text, View } from "react-native";
import { Body, Button, Card, Chip, Field, H1, H3, Small } from "../components/ui";
import { FormShell } from "../components/FormShell";
import { NotifyToggle } from "../components/NotifyToggle";
import { useMemory } from "../lib/memory";
import { setPref, usePrefs } from "../lib/prefs";
import { success } from "../lib/haptics";
import { colors } from "../theme";

const APPEARANCE = [["auto", "Same as my phone"], ["light", "Light"], ["dark", "Dark"]];
const LAYOUT = [["swipe", "Swipe cards"], ["list", "List"]];

/** Settings: the name and phone used for pickup, light or dark, how the Menu is laid out, and a way to clear everything the app remembers. All of it lives on this phone only. */
export default function Settings() {
  const { contact, rememberContact, resetAll } = useMemory();
  const { appearance, menuLayout } = usePrefs();
  const [name, setName] = useState(contact.name), [phone, setPhone] = useState(contact.phone);
  const [saved, setSaved] = useState(false), [sure, setSure] = useState(false), [cleared, setCleared] = useState(false);
  const changed = name.trim() !== contact.name || phone.trim() !== contact.phone;
  return (
    <FormShell>
      <H1>Settings</H1>

      <Card style={{ padding: 16, gap: 12 }}>
        <H3>Your details</H3>
        <Small>Used to fill in your name and phone when you order. Saved on this phone only.</Small>
        <Field label="Name" value={name} onChangeText={(t) => { setName(t); setSaved(false); }} autoComplete="name" textContentType="name" />
        <Field label="Phone number" value={phone} onChangeText={(t) => { setPhone(t); setSaved(false); }} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Button title={saved ? "Saved" : "Save"} variant="gold" size="medium" icon={saved ? "checkmark" : undefined} disabled={!changed && !saved} onPress={() => { rememberContact(name.trim(), phone.trim()); setSaved(true); success(); }} />
      </Card>

      <Card style={{ padding: 16, gap: 12 }}>
        <H3>Appearance</H3>
        <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {APPEARANCE.map(([id, label]) => <Chip key={id} label={label} active={appearance === id} onPress={() => setPref("appearance", id)} />)}
        </View>
      </Card>

      <Card style={{ padding: 16, gap: 12 }}>
        <H3>Menu</H3>
        <View accessibilityRole="radiogroup" accessibilityLabel="Menu layout" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LAYOUT.map(([id, label]) => <Chip key={id} label={label} active={menuLayout === id} onPress={() => setPref("menuLayout", id)} />)}
        </View>
        <Small>Swipe cards: one category at a time, scroll right. List: every category one under the other.</Small>
      </Card>

      <Card style={{ padding: 16, gap: 12 }}>
        <H3>Order notifications</H3>
        <NotifyToggle />
        <Small>When an order is placed, the order screen has a button to turn these on.</Small>
      </Card>

      <Card style={{ padding: 16, gap: 12 }}>
        <H3>Your data</H3>
        <Body>Favorites, your usual drinks, past orders, points counted on this phone, recent searches and the name and phone above are saved only on this phone. The café does not have a copy. Points kept in Square stay with your phone number there.</Body>
        {cleared ? <Text accessibilityRole="alert" style={{ fontSize: 16, fontWeight: "800", color: colors.success }}>Cleared. This phone has forgotten everything above.</Text> : sure ? (
          <View style={{ gap: 10 }}>
            <Text accessibilityRole="alert" style={{ fontSize: 16, fontWeight: "800", color: colors.danger }}>This cannot be undone. Clear everything the app remembers on this phone?</Text>
            <Button title="Yes, clear it all" variant="primary" size="medium" onPress={() => { resetAll(); setName(""); setPhone(""); setSure(false); setCleared(true); }} />
            <Button title="No, keep it" variant="outline" size="medium" onPress={() => setSure(false)} />
          </View>
        ) : <Button title="Clear everything on this phone" variant="outline" size="medium" icon="trash-outline" onPress={() => setSure(true)} />}
      </Card>
    </FormShell>
  );
}
