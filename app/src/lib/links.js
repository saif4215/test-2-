import { Linking, Platform } from "react-native";
import { parseContactLink } from "./links-util";

// Opening a link the same way everywhere, so a tap always does something:
//  - on a phone: the phone's own app opens (dialer, mail, browser, maps);
//  - in a browser on a phone: phone and mail links open the app, web links open a new tab;
//  - in a browser on a computer, which has no dialer: phone and mail links show the number or address with a Copy button instead of doing nothing.
const listeners = new Set();
export { prettyPhone } from "./links-util";
export const onLinkSheet = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const isWeb = Platform.OS === "web" && typeof window !== "undefined";
const touchScreen = () => isWeb && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

export function openLink(url) {
  if (!isWeb) return Linking.openURL(url);
  const contact = parseContactLink(url);
  if (contact) {
    if (touchScreen()) { window.location.href = url; return undefined; }
    for (const fn of listeners) fn(contact);
    return undefined;
  }
  // a web link: a new tab. Some viewers refuse window.open from a page, so fall back to a real link click.
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); a.remove();
  }
  return undefined;
}

/**
 * Props that make a button a real link on the web (a web address, opened in a new tab by the browser itself), so it also works where a page
 * may not open windows from script. On a phone, and for phone and mail links, nothing is added: openLink does the work.
 */
export function webLinkProps(url) {
  if (!isWeb || !/^https?:/i.test(String(url))) return {};
  return { href: url, hrefAttrs: { target: "_blank", rel: "noopener noreferrer" } };
}
