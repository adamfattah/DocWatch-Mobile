import sharp from "sharp";
import convertHeic from "heic-convert";

// OpenAI vision accepts only these. Anything else (HEIC from the iPhone camera roll, TIFF, BMP, AVIF...)
// is converted to JPEG here as a backup; the app already converts on-device before upload.
const OPENAI_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_LONG_EDGE = 2400;

export async function toOpenAIImage(bytes: Buffer, contentType: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const type = contentType.toLowerCase().split(";")[0].trim();
  if (OPENAI_IMAGE_TYPES.has(type) && !looksLikeHeic(bytes)) return { bytes, mimeType: type };

  let source = bytes;
  if (type === "image/heic" || type === "image/heif" || looksLikeHeic(bytes)) {
    source = Buffer.from((await convertHeic({ buffer: bytes as any, format: "JPEG", quality: 0.9 })) as unknown as Uint8Array);
  }
  const out = await sharp(source, { failOn: "none" })
    .rotate() // honour EXIF orientation so the text is upright
    .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { bytes: out, mimeType: "image/jpeg" };
}

// ISO base media file box with an HEIC/HEIF brand, in case the upload was tagged octet-stream or image/jpeg.
function looksLikeHeic(b: Buffer) {
  if (b.length < 12 || b.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = b.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand);
}
