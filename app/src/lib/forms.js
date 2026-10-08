import { isPast, parseDate, parseTime } from "./dates";

export const QUOTE_THANKS = "Your request has been received. Maruf Cafe will contact you to discuss your order.";
export const EVENT_THANKS = "Maruf Cafe has received your event request. Someone will contact you soon to discuss availability, pricing, food options, and your event.";

/** Turn what the customer typed into the fields the server expects, or return per-field errors. */
export function buildQuote(v, now = new Date()) {
  const errors = {}, need = (k, msg) => { if (!String(v[k] || "").trim()) errors[k] = msg; };
  need("fullName", "Enter your full name."); need("foodItems", "Tell us what food you'd like."); need("phone", "Enter a phone number.");
  if (v.phone && v.phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a phone number we can call.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || "")) errors.email = "Enter a valid email address.";
  if (v.fulfillment === "delivery" && !String(v.deliveryAddress || "").trim()) errors.deliveryAddress = "Enter the address to deliver to.";
  const dateNeeded = parseDate(v.dateNeeded, now);
  if (!dateNeeded) errors.dateNeeded = "Enter the date as MM/DD/YYYY."; else if (isPast(dateNeeded, now)) errors.dateNeeded = "Choose a date that has not passed.";
  if (!v.fulfillment) errors.fulfillment = "Choose pickup or delivery.";
  const people = Number.parseInt(v.people, 10);
  if (!(people >= 1 && people <= 5000)) errors.people = "Enter how many people (1 to 5000).";
  let pickupTime = "";
  if (v.pickupTime.trim()) { pickupTime = parseTime(v.pickupTime); if (!pickupTime) errors.pickupTime = "Enter a time like 5:30 PM."; }
  const fields = { fullName: v.fullName.trim(), phone: v.phone.trim(), email: v.email.trim(), dateNeeded, fulfillment: v.fulfillment, people: String(people), pickupTime, foodItems: v.foodItems.trim(), specialRequests: v.specialRequests.trim(), budget: v.budget.trim(), notes: v.notes.trim(), occasion: v.occasion, contactMethod: v.contactMethod || "", dietary: (v.dietary || "").trim(), deliveryAddress: v.fulfillment === "delivery" ? (v.deliveryAddress || "").trim() : "" };
  return { errors, fields };
}


export function buildEvent(v, now = new Date()) {
  const errors = {};
  if (!v.name.trim()) errors.name = "Enter your name.";
  if (v.phone.replace(/\D/g, "").length < 7) errors.phone = "Enter a phone number we can call.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || "")) errors.email = "Enter a valid email address.";
  if (!v.eventType) errors.eventType = "Choose the type of event.";
  const eventDate = parseDate(v.eventDate, now);
  if (!eventDate) errors.eventDate = "Enter the date as MM/DD/YYYY."; else if (isPast(eventDate, now)) errors.eventDate = "Choose a date that has not passed.";
  let startTime = "", endTime = "";
  if (v.startTime.trim()) { startTime = parseTime(v.startTime); if (!startTime) errors.startTime = "Enter a time like 6:00 PM."; }
  if (v.endTime.trim()) { endTime = parseTime(v.endTime); if (!endTime) errors.endTime = "Enter a time like 9:00 PM."; }
  let alternateDate = "";
  if ((v.alternateDate || "").trim()) { alternateDate = parseDate(v.alternateDate, now); if (!alternateDate) errors.alternateDate = "Enter the date as MM/DD/YYYY."; else if (isPast(alternateDate, now)) errors.alternateDate = "Choose a date that has not passed."; }
  if (startTime && endTime && endTime <= startTime) errors.endTime = "The end time must be after the start time.";
  const guests = Number.parseInt(v.guests, 10);
  if (!(guests >= 1 && guests <= 1000)) errors.guests = "Enter how many guests (1 to 1000).";
  const fields = { name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim(), eventType: v.eventType, eventDate, startTime, endTime, guests: String(guests), needFood: v.needFood, catering: v.catering, foodBudget: v.foodBudget.trim(), venueType: v.venueType, specialRequests: v.specialRequests.trim(), decorations: v.decorations.trim(), entertainment: v.entertainment.trim(), notes: v.notes.trim(), packageInterest: v.packageInterest, contactMethod: v.contactMethod || "", alternateDate, budget: (v.budget || "").trim(), dietary: (v.dietary || "").trim() };
  return { errors, fields };
}

