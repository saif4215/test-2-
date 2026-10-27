// Which built-in rendered picture suits a menu item. Pure, so it is tested without a phone.
// The café's own picture for an item always wins over these (see ItemPhoto in MenuBrowser).
// Drinks are matched by name, so each kind of drink gets its own picture; anything not matched falls back to its category.
const BY_NAME = [
  [/pizza/, "pizza"], [/burger/, "burger"], [/panini|sandwich/, "sandwich"],
  // coffee
  [/^espresso/, "espresso"], [/americano/, "americano"], [/^drip/, "drip"], [/cappuccino/, "cappuccino"], [/flat white/, "flatwhite"], [/cortado/, "cortado"],
  [/hazelnut mocha/, "hazelnutmocha"], [/white mocha/, "whitemocha"], [/mocha/, "mocha"], [/dirty chai/, "dirtychai"], [/pumpkin/, "pumpkin"], [/pistachio/, "pistachio"],
  [/spanish latte|oat brown sugar|biscoff|maple honey|honey vanilla|banana bread/, "icedlatte"], [/^latte$/, "coffee"],
  // tea
  [/earl grey/, "tea"], [/chai latte/, "chai"], [/london fog/, "londonfog"], [/matcha/, "matcha"], [/yuzu/, "yuzu"], [/peppermint/, "peppermint"], [/hibiscus/, "hibiscus"], [/chamomile/, "chamomile"],
  // refreshers
  [/berry blast/, "berry"], [/kiwi/, "kiwi"], [/^lemonade/, "lemonade"], [/mango dragon/, "mangodragon"], [/mango passion/, "mangopassion"], [/strawberry acai/, "refresher"],
  [/tropical/, "tropical"], [/watermelon/, "watermelon"], [/white peach/, "whitepeach"], [/lychee/, "lychee"],
  // other drinks
  [/hot chocolate|cocoa/, "hotchoc"], [/strawberry banana/, "smoothie"],
];
const BY_CATEGORY = [[/coffee/, "coffee"], [/refresher/, "refresher"], [/\btea\b/, "tea"], [/smoothie/, "smoothie"], [/breakfast/, "breakfast"], [/sandwich/, "sandwich"], [/burger/, "burger"],
  [/bowl|salad/, "bowl"], [/chicken|wing/, "chicken"], [/side/, "sides"], [/sweet|dessert/, "sweets"]];

export function artKey({ name = "", cat = "" } = {}) {
  const n = String(name).toLowerCase(), c = String(cat).toLowerCase();
  for (const [re, key] of BY_NAME) if (re.test(n)) return key;
  for (const [re, key] of BY_CATEGORY) if (re.test(c)) return key;
  return null;
}
