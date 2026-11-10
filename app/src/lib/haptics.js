import * as Haptics from "expo-haptics";

// Small physical taps, like the best food apps have: a light tick when adding, a firmer one when something is done.
// If the phone (or the browser) has no haptics, or they are switched off, nothing happens and nothing breaks.
const quiet = () => {};
export const tap = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet); } catch { /* no haptics here */ } };
export const select = () => { try { Haptics.selectionAsync().catch(quiet); } catch { /* no haptics here */ } };
export const success = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet); } catch { /* no haptics here */ } };
export const warn = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(quiet); } catch { /* no haptics here */ } };
