import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { extractFromFile } from "./extract";
import { sendPush } from "./push";
import { toOpenAIImage } from "./convert";
import type { DocRecord, UserRecord } from "./types";

const REVIEW_THRESHOLD = 0.6;

// Shared by the Storage trigger and reprocessDoc: download the stored file, run extraction,
// write the result, notify. Never logs document contents.
export async function processDoc(uid: string, docId: string, hint?: { bucket?: string; contentType?: string }) {
  const db = getFirestore();
  const ref = db.doc(`users/${uid}/docs/${docId}`);
  const rec = (await ref.get()).data() as DocRecord | undefined;
  if (!rec?.storagePath) throw new Error("Document record is missing its file path");

  const file = getStorage().bucket(hint?.bucket).file(rec.storagePath);
  const [[bytes], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
  const contentType = hint?.contentType ?? (meta.contentType as string | undefined) ?? rec.contentType ?? "application/octet-stream";

  try {
    const input = contentType === "application/pdf" ? { bytes, mimeType: contentType } : await toOpenAIImage(bytes, contentType);
    const x = await extractFromFile(input.bytes, input.mimeType);
    const hasDate = !!(x.expirationDate || x.renewalDate);
    const needsReview = !hasDate || x.confidence < REVIEW_THRESHOLD;

    const update: Omit<Partial<DocRecord>, "error"> & { error: null } = {
      ...x,
      status: hasDate ? "ready" : "no_date",
      needsReview,
      remindersSent: [],
      processedAt: Timestamp.now(),
      error: null,
    };
    await ref.set(update, { merge: true });

    const user = (await db.doc(`users/${uid}`).get()).data() as UserRecord | undefined;
    if (needsReview) {
      await sendPush(user?.pushToken, "Quick check?",
        hasDate ? `We read "${x.title}" expiring ${x.expirationDate ?? x.renewalDate}. Tap to confirm.`
                : `We couldn't find an expiration date on "${x.title}". Tap to add one (optional).`,
        { docId });
    } else {
      await sendPush(user?.pushToken, "Got it",
        `${x.title} - expires ${x.expirationDate ?? x.renewalDate}. We'll remind you.`, { docId });
    }
    return update.status;
  } catch (e: any) {
    // Log the error class and message only; never the file or the model output.
    console.error("extraction failed", docId, e?.code ?? e?.name ?? "", String(e?.message ?? e).slice(0, 300));
    await ref.set({ status: "failed", error: String(e?.message ?? e), processedAt: Timestamp.now() }, { merge: true });
    return "failed" as const;
  }
}
