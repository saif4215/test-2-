import { Redirect } from "expo-router";

/** The old Orders tab: large orders and catering now live under Groups. This keeps old links (and the old /large-orders address) working. */
export default function Orders() {
  return <Redirect href="/groups" />;
}
