import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { processDoc } from "./process";
import { sendPush } from "./push";
import { buildExport } from "./exporter";
import { dueDefaultReminder, customReminderDue, defaultMessage, customMessage, ReminderDoc } from "./reminders";
import type { DocRecord, UserRecord } from "./types";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });
const db = getFirestore();
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const EXPORT_TTL_HOURS = 24;
const RECENT_LOGIN_SECONDS = 5 * 60;

// 1) File lands in Storage -> classify + extract -> write Firestore doc -> maybe ask for review.
export const onDocUploaded = onObjectFinalized({ memory: "1GiB", timeoutSeconds: 120, secrets: [OPENAI_API_KEY] }, async (event) => {
  const path = event.data.name; // users/{uid}/docs/{docId}/original.ext
  const m = path.match(/^users\/([^/]+)\/docs\/([^/]+)\//);
  if (!m) return;
  const [, uid, docId] = m;
  await processDoc(uid, docId, { bucket: event.data.bucket, contentType: event.data.contentType });
});

// 1b) "Try again" on a failed doc: re-run extraction on the file already in Storage. Owner only.
export const reprocessDoc = onCall({ memory: "1GiB", timeoutSeconds: 120, secrets: [OPENAI_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const docId = typeof request.data?.docId === "string" ? request.data.docId : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(docId)) throw new HttpsError("invalid-argument", "docId is required.");
  const ref = db.doc(`users/${uid}/docs/${docId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Document not found."); // also covers other users' docs: the path is scoped to the caller
  if (!snap.data()?.storagePath?.startsWith(`users/${uid}/docs/${docId}/`)) throw new HttpsError("permission-denied", "Not your document.");
  await ref.set({ status: "processing", error: null, needsReview: false }, { merge: true });
  const status = await processDoc(uid, docId);
  return { status };
});

// 2) Every 15 minutes: default-schedule reminders at each user's local reminder time, plus one-off custom reminders.
//    All the maths lives in reminders.ts (pure, unit-tested).
export const sendReminders = onSchedule("every 15 minutes", async () => {
  const users = await db.collection("users").where("pushToken", "!=", null).get();
  const now = new Date();

  for (const u of users.docs) {
    const user = u.data() as UserRecord;
    if (user.notificationsEnabled === false) continue;
    const docs = await u.ref.collection("docs").get();
    for (const d of docs.docs) {
      const rec = d.data() as DocRecord;
      const doc: ReminderDoc = { ...rec, customReminderAt: toDate(rec.customReminderAt), customReminderSentAt: toDate(rec.customReminderSentAt) };

      const due = dueDefaultReminder(doc, user, now);
      if (due) {
        const msg = defaultMessage(doc, due);
        await sendPush(user.pushToken, msg.title, msg.body, { docId: d.id });
        await d.ref.update({ remindersSent: FieldValue.arrayUnion(...due.markSent) });
      }
      if (customReminderDue(doc, user, now)) {
        const msg = customMessage(doc);
        await sendPush(user.pushToken, msg.title, msg.body, { docId: d.id });
        await d.ref.update({ customReminderSentAt: Timestamp.fromDate(now) });
      }
    }
  }
});

// 3) Export My Data: zip of every original file plus documents.json, under exports/{uid}/, short-lived link.
export const exportData = onCall({ memory: "1GiB", timeoutSeconds: 300 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const bucket = getStorage().bucket();
  const docs = await db.collection(`users/${uid}/docs`).get();
  const records = docs.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  const path = `exports/${uid}/docwatch-export-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  await buildExport(bucket, uid, records, path);

  // Prefer a signed URL (needs the runtime service account to be allowed to sign). If that is not set up,
  // return the path; the app reads it through Storage rules (exports/{uid} is owner-readable).
  const expiresAt = Date.now() + 15 * 60 * 1000;
  try {
    const [url] = await bucket.file(path).getSignedUrl({ version: "v4", action: "read", expires: expiresAt });
    return { url, path, expiresAt, count: records.length };
  } catch (e: any) {
    console.warn("signed url unavailable, returning path", e?.code ?? e?.message);
    return { url: null, path, expiresAt, count: records.length };
  }
});

// 3b) Hourly: remove exports older than 24 hours.
export const cleanupExports = onSchedule("every 60 minutes", async () => {
  const [files] = await getStorage().bucket().getFiles({ prefix: "exports/" });
  const cutoff = Date.now() - EXPORT_TTL_HOURS * 3600 * 1000;
  for (const f of files) {
    const created = new Date(f.metadata.timeCreated as string).getTime();
    if (created < cutoff) await f.delete().catch(() => {});
  }
});

// 4) Delete Account: files, exports, Firestore tree, then the Auth user. Requires a recent sign-in.
export const deleteAccount = onCall({ memory: "512MiB", timeoutSeconds: 300 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const authTime = Number(request.auth?.token?.auth_time ?? 0);
  if (Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) throw new HttpsError("failed-precondition", "recent-login");

  const bucket = getStorage().bucket();
  await bucket.deleteFiles({ prefix: `users/${uid}/`, force: true });
  await bucket.deleteFiles({ prefix: `exports/${uid}/`, force: true });
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth().deleteUser(uid);
  return { ok: true };
});

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as any).toDate === "function") return (v as any).toDate();
  if (typeof v === "string" || typeof v === "number") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return null;
}

// Firestore Timestamps -> ISO strings so the export JSON is readable.
function plain(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}
