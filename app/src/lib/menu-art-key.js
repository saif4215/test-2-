// Which built-in rendered picture suits a menu item. Pure, so it is tested without a phone.
// The café's own picture for an item always wins over these (see ItemPhoto in MenuBrowser).
const BY_NAME = [[/pizza/, "pizza"], [/hot chocolate|cocoa/, "tea"], [/burger/, "burger"], [/panini|sandwich/, "sandwich"]];
const BY_CATEGORY = [[/coffee/, "coffee"], [/refresher/, "refresher"], [/\btea\b/, "tea"], [/smoothie/, "smoothie"], [/breakfast/, "breakfast"], [/sandwich/, "sandwich"], [/burger/, "burger"],
  [/bowl|salad/, "bowl"], [/chicken|wing/, "chicken"], [/side/, "sides"], [/sweet|dessert/, "sweets"]];

export function artKey({ name = "", cat = "" } = {}) {
  const n = String(name).toLowerCase(), c = String(cat).toLowerCase();
  for (const [re, key] of BY_NAME) if (re.test(n)) return key;
  for (const [re, key] of BY_CATEGORY) if (re.test(c)) return key;
  return null;
}
