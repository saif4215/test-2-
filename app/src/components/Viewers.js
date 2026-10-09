import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import Model3D, { supported } from "./Model3D";
import { Button, H1, Small } from "./ui";
import { colors } from "../theme";

/** A 3D burger you can spin and take apart. Web app only. */
export function BurgerViewer() {
  const [apart, setApart] = useState(false), [failed, setFailed] = useState(false);
  if (!supported || failed) return null;
  return (
    <View style={{ gap: 14 }}>
      <H1>Burgers</H1>
      <Model3D kind="burger" exploded={apart} height={380} label="A 3D burger. Drag to spin it. Use the button to take it apart." onFail={() => setFailed(true)} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title={apart ? "Put it back together" : "Take it apart"} variant="primary" size="medium" onPress={() => setApart(!apart)} style={{ flex: 1.4 }} />
        <Button title="See burgers" variant="outline" size="medium" onPress={() => router.push("/menu")} style={{ flex: 1 }} />
      </View>
      <Small>Drag to spin. This is an illustration of a burger, so the toppings on each menu item can differ.</Small>
    </View>
  );
}

/** The Maruf cup, spinning. Web app only. */
export function CupViewer() {
  const [failed, setFailed] = useState(false);
  if (!supported || failed) return null;
  return (
    <View style={{ gap: 10 }}>
      <Model3D kind="cup" height={300} label="A 3D Maruf Cafe coffee cup. Drag to spin it." onFail={() => setFailed(true)} />
      <Small>Coffee to go. Drag to spin the cup.</Small>
    </View>
  );
}
