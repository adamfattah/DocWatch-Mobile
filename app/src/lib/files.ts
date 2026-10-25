import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export const isImage = (contentType: string) => contentType.startsWith("image/");
export const isPdf = (contentType: string) => contentType === "application/pdf";

const EXT: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/heic": "heic", "image/heif": "heif", "image/webp": "webp", "image/gif": "gif",
};
const UTI: Record<string, string> = { pdf: "com.adobe.pdf", jpg: "public.jpeg", png: "public.png", heic: "public.heic" };

// "Passport - Adam.pdf" style name: document title, sanitised for the filesystem, plus the right extension.
export function fileNameFor(title: string | undefined, contentType: string, storagePath: string) {
  const ext = EXT[contentType] ?? storagePath.split(".").pop()?.toLowerCase() ?? "bin";
  const base = (title || "Document").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Document";
  return { name: `${base}.${ext}`, ext };
}

// Downloads the file to the cache under a readable name, then opens the iOS share sheet
// (Save to Files, AirDrop, Print, open in another app).
export async function downloadAndShare(url: string, title: string | undefined, contentType: string, storagePath: string) {
  const { name, ext } = fileNameFor(title, contentType, storagePath);
  const dir = `${FileSystem.cacheDirectory}share/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const target = dir + encodeURIComponent(name);
  const res = await FileSystem.downloadAsync(url, target);
  if (res.status && res.status >= 400) throw new Error(`Download failed (${res.status})`);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(res.uri, { mimeType: contentType, UTI: UTI[ext], dialogTitle: name });
}
