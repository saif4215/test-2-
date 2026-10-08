import menu from "../data/menu.json";

// Icon for each menu category. New categories fall back to the generic fork-and-knife.
const icons = {
  Coffee: "cafe-outline", Refreshers: "water-outline", Tea: "leaf-outline", "Smoothies/ Others": "nutrition-outline", "Smoothies / Others": "nutrition-outline",
  Breakfast: "sunny-outline", Sandwiches: "fast-food-outline", Burgers: "fast-food-outline", Bowls: "restaurant-outline",
  "Chicken & Wings": "flame-outline", "Salads / Others": "pizza-outline", Sides: "pizza-outline", Sweets: "ice-cream-outline",
  "Catering Trays": "albums-outline", "Family Meals": "people-outline",
};
export const iconFor = (name) => icons[name] || "restaurant-outline";

/** [{ name, group, items }] in menu order. */
export const categories = Object.entries(menu.groups).flatMap(([group, cats]) => Object.entries(cats).map(([name, items]) => ({ name, group, items })));
