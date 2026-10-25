// archiver 8 is ESM-only and exports classes (no default factory); require() of it works on Node 22+.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ZipArchive } = require("archiver") as { ZipArchive: new (opts?: Record<string, unknown>) => any };
import { finished } from "node:stream/promises";
import type { Bucket } from "@google-cloud/storage";

// Streams a zip straight into Storage: files/<docId>.<ext> for every original plus documents.json.
export async function buildExport(bucket: Bucket, uid: string, records: Array<{ id: string; storagePath?: string; title?: string }>, path: string) {
  const out = bucket.file(path).createWriteStream({ contentType: "application/zip", resumable: false });
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const done = finished(out);
  archive.on("warning", (e: any) => console.warn("export warning", e?.code));
  archive.pipe(out);

  for (const r of records) {
    const sp = r.storagePath;
    if (!sp || !sp.startsWith(`users/${uid}/docs/${r.id}/`)) continue;
    const [exists] = await bucket.file(sp).exists();
    if (!exists) continue;
    archive.append(bucket.file(sp).createReadStream(), { name: `files/${r.id}.${sp.split(".").pop()}` });
  }
  archive.append(JSON.stringify({ exportedAt: new Date().toISOString(), documents: records }, null, 2), { name: "documents.json" });
  await archive.finalize();
  await done;
}
