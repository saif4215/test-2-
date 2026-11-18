// The choices Settings can make, and the check that keeps a bad saved value from breaking the app. Pure, so it is tested without a phone.
export const ALLOWED = { appearance: ["auto", "light", "dark"], menuLayout: ["swipe", "list"] };
export const DEFAULTS = { appearance: "auto", menuLayout: "swipe" };

/** The value if it is one we know, otherwise the default. */
export const cleanPref = (name, value) => (ALLOWED[name] && ALLOWED[name].includes(value) ? value : DEFAULTS[name]);
