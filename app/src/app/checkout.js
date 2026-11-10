import { Redirect } from "expo-router";

/** Placing an order used to be its own screen. Pickup details now live on My order, so anything that still opens this goes there. */
export default function Checkout() {
  return <Redirect href="/order" />;
}
