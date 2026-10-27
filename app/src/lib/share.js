// The text a customer sends a friend with "Share Maruf Cafe". Only details the café itself published: name, address, phone, order link.
export function shareText(b) {
  const lines = [b.name || "Maruf Cafe", (b.address || []).join(", "), b.phone, b.orderUrl ? `Order: ${b.orderUrl}` : ""].filter((l) => typeof l === "string" && l.trim());
  return lines.join("\n");
}
