// ──────────────────────────────────────────────────────────────────────────────
// Everything the café owner is likely to edit lives in this file, in menu.json,
// and in photos.js. Nothing else needs to change for routine updates.
// ──────────────────────────────────────────────────────────────────────────────

export const business = {
  name: "Maruf Cafe",
  address: ["365 Veterans Rd W", "Staten Island, NY 10309"],
  phone: "(929) 335-3296",
  phoneTel: "+19293353296",
  email: "",   // "[ADD EMAIL]" shows on screen until you put an address here
  orderUrl: "https://www.marufcafe.com/s/order",      // Square Online store
  giftCardsUrl: "https://www.marufcafe.com/s/gift-cards",
  instagram: "https://www.instagram.com/maruf.cafe/",
  tiktok: "https://www.tiktok.com/@marufsi1",
  // Hours in New York time. open/close are 24-hour clock hours. days: 0 = Sunday ... 6 = Saturday.
  hours: [
    { label: "Mon – Sat", days: [1, 2, 3, 4, 5, 6], open: 7, close: 22 },
    { label: "Sunday", days: [0], open: 7, close: 16 },
  ],
};

// Where quote and event requests are sent. Set EXPO_PUBLIC_API_URL when building (see README).
export const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

export const occasions = [
  "Family gatherings", "Parties", "Birthdays", "Business meetings", "School events",
  "Community events", "Celebrations", "Holiday gatherings", "Group meals",
];

export const catering = [
  { title: "Birthday Parties", body: "Food for small or large birthday celebrations.", icon: "gift-outline", photo: "cateringBirthday" },
  { title: "Business Catering", body: "Meals for meetings, offices, and corporate events.", icon: "briefcase-outline", photo: "cateringBusiness" },
  { title: "Family Gatherings", body: "Make feeding a large family gathering simple.", icon: "people-outline", photo: "cateringFamily" },
  { title: "Community Events", body: "Large-order options for community gatherings and events.", icon: "earth-outline", photo: "cateringCommunity" },
  { title: "Holiday Events", body: "Food for special occasions and holiday celebrations.", icon: "sparkles-outline", photo: "cateringHoliday" },
];

export const venueUses = [
  { title: "Birthday Parties", icon: "gift-outline" }, { title: "Engagements", icon: "heart-outline" },
  { title: "Family Gatherings", icon: "people-outline" }, { title: "Private Dinners", icon: "wine-outline" },
  { title: "Business Meetings", icon: "briefcase-outline" }, { title: "Community Events", icon: "earth-outline" },
  { title: "Celebrations", icon: "sparkles-outline" }, { title: "Other Private Events", icon: "calendar-outline" },
];

// No prices are listed on purpose. Add a "price" line to a package only when you are ready to publish one.
export const packages = [
  { id: "Basic Gathering", title: "Basic Gathering", blurb: "For smaller gatherings.", includes: ["Event space", "Seating", "Food options available", "Custom arrangements"] },
  { id: "Large Gathering", title: "Large Gathering", blurb: "For larger parties and celebrations.", includes: ["Larger event setup", "Food/catering options", "Seating arrangements", "Custom requests"] },
  { id: "Private Event", title: "Private Event", blurb: "For customers looking for a more private experience.", includes: ["Private event setup", "Customized food options", "Flexible arrangements", "Event planning discussion"] },
];
export const packagesNote = "Pricing and availability depend on the date, number of guests, event type, food requirements, and rental arrangements.";

// Menu categories to show even when they have no items yet (shown as "ask us" cards). Edit freely.
export const placeholderCategories = ["Catering Trays", "Family Meals"];

// Group-size calculator. Leave a value as null when you do not know it: the calculator then tells the
// customer that Maruf Cafe will confirm it, instead of guessing.
//   perGuest : how many of this item to plan per guest
//   serves   : how many people one family-style meal / tray feeds
//   price    : price per meal / tray / drink / dessert, in dollars
export const calculator = {
  individual: { label: "Individual meals", perGuest: 1, price: null },
  family: { label: "Family-style meals", serves: null, price: null },
  trays: { label: "Catering trays", serves: null, price: null },
  drinks: { label: "Drinks", perGuest: null, price: null },
  desserts: { label: "Desserts", perGuest: null, price: null },
};

export const faq = [
  { q: "Do you accept large orders?", a: "Yes. Contact Maruf Cafe with your date, group size, and food requirements to discuss your order." },
  { q: "Can I rent Maruf Cafe for a private event?", a: "Private event and venue rental requests can be submitted through our event inquiry form. Availability depends on the date and the size of your group, so send us your details and we will get back to you." },
  { q: "How do I get a price?", a: "Pricing depends on the date, number of guests, event type, food requirements, and rental arrangements. Send a request and Maruf Cafe will discuss the details with you." },
  { q: "How far ahead should I contact you?", a: "As early as you can. The earlier we hear from you, the better the chance we can plan around your date." },
  { q: "Do you offer delivery?", a: "Choose Pickup or Delivery on the large order form and Maruf Cafe will confirm what is possible for your location." },
  { q: "Can I bring decorations or entertainment?", a: "Tell us about your plans in the event form and we will discuss it with you." },
];
