import { Redirect } from "expo-router";

/** The old Events tab: renting the café now lives under Groups. This keeps old links (and the old /rent-the-cafe address) working. */
export default function Events() {
  return <Redirect href={{ pathname: "/groups", params: { show: "rent" } }} />;
}
