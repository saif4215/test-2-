import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Small } from "./ui";
import { enableNotify, notifyOn, notifyPermission, notifySupported } from "../lib/notify";

/** "Tell me when it's ready": asks once, then the order's change to ready is announced on this device. Not shown where the device cannot do it. */
export function NotifyToggle() {
  const [state, setState] = useState("checking");   // checking, off, on, denied, unsupported
  useEffect(() => {
    let live = true;
    if (!notifySupported()) { setState("unsupported"); return undefined; }
    notifyOn().then((on) => { if (live) setState(on ? "on" : notifyPermission() === "denied" ? "denied" : "off"); });
    return () => { live = false; };
  }, []);
  if (state === "checking" || state === "unsupported") return null;
  if (state === "on") return <Small accessibilityRole="alert">We'll let you know when your order is ready, as long as this app is still open or running in the background.</Small>;
  if (state === "denied") return <Small>Notifications are blocked for this app. You can turn them on in your browser or phone settings.</Small>;
  return (
    <View style={{ gap: 6 }}>
      <Button title="Tell me when it's ready" variant="outline" size="medium" icon="notifications-outline" onPress={async () => { const r = await enableNotify(); setState(r === "granted" ? "on" : r === "denied" ? "denied" : "off"); }} />
      <Small>Works while this app is open or running in the background. If you close it completely, you will not hear from us until you open it again.</Small>
    </View>
  );
}
