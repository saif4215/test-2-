import { useState } from "react";
import { View } from "react-native";
import Model3D, { supported } from "./Model3D";
import { Button, Disclosure, Eyebrow, H2, Small } from "./ui";

/** A 3D burger you can spin and take apart. Web app only. */
export function BurgerViewer() {
  const [apart, setApart] = useState(false), [failed, setFailed] = useState(false);
  if (!supported || failed) return null;
  return (
    <View style={{ gap: 12 }}>
      <H2>Burgers</H2>
      <Model3D kind="burger" exploded={apart} height={340} label="A 3D burger. Drag to spin it. Use the button to take it apart." onFail={() => setFailed(true)} />
      <Button title={apart ? "Put it back together" : "Take it apart"} variant="primary" size="medium" onPress={() => setApart(!apart)} />
      <Small>Drag to spin. This is an illustration of a burger, so the toppings on each menu item can differ.</Small>
    </View>
  );
}

/** The Maruf cup, spinning. Web app only. */
export function CupViewer() {
  const [failed, setFailed] = useState(false);
  if (!supported || failed) return null;
  return (
    <View style={{ gap: 12 }}>
      <H2>Coffee to go</H2>
      <Model3D kind="cup" height={300} label="A 3D Maruf Cafe coffee cup. Drag to spin it." onFail={() => setFailed(true)} />
      <Small>Drag to spin the cup.</Small>
    </View>
  );
}

/** The 3D models, together under one small heading at the very end of the Menu. Nothing at all where 3D is not available (phones). */
export function CloserLook() {
  if (!supported) return null;
  return (
    <View style={{ marginTop: 28 }}>
      <Disclosure icon="cube-outline" title="A closer look" hint="Spin a 3D burger and take a look at our cup">
        <View style={{ gap: 28 }}>
          <BurgerViewer />
          <CupViewer />
        </View>
      </Disclosure>
    </View>
  );
}
