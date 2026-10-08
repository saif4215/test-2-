/** Direction links for the café's address. The address text is the only thing sent: no coordinates are guessed. */
export function mapLinks(addressLines) {
  const q = encodeURIComponent(addressLines.join(", "));
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple: `https://maps.apple.com/?daddr=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}
