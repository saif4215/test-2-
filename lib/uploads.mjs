// Photo uploads: only real JPEG, PNG and WebP files (checked by their first bytes, not by their name).
// SVG is refused on purpose, because it can carry scripts.

export function detectImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
export const MAX_UPLOADS = 120;
