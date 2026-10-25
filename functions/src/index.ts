import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { processDoc } from "./process";
import { sendPush } from "./push";
import type { DocRecord, UserRecord } from "./types";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });
const db = getFirestore();
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// Defaults - the user never configures these.
const REMINDER_DAYS = [30, 7, 1, 0]; // days before expiry; 0 = day of
const LOCAL_SEND_HOUR = 9;           // 9am in the user's timezone

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

// 2) Hourly: for every user whose local time is 9am, send due reminders.
export const sendReminders = onSchedule("every 60 minutes", async () => {
  const users = await db.collection("users").where("pushToken", "!=", null).get();
  const now = new Date();

  for (const u of users.docs) {
    const user = u.data() as UserRecord;
    const tz = user.timezone || "UTC";
    const local = localParts(now, tz);
    if (local.hour !== LOCAL_SEND_HOUR) continue;

    const docs = await u.ref.collection("docs").where("status", "==", "ready").get();
    for (const d of docs.docs) {
      const doc = d.data() as DocRecord;
      const target = doc.expirationDate ?? doc.renewalDate;
      if (!target) continue;
      const daysLeft = daysBetween(local.date, target);
      const sent = new Set(doc.remindersSent ?? []);
      // Send the smallest reminder bucket that is due and not yet sent (covers missed days).
      const due = REMINDER_DAYS.filter((n) => daysLeft <= n && !sent.has(n)).sort((a, b) => a - b)[0];
      if (due === undefined || daysLeft < 0) continue;

      const when = daysLeft === 0 ? "expires today" : daysLeft === 1 ? "expires tomorrow" : `expires in ${daysLeft} days`;
      await sendPush(user.pushToken, `${doc.title} ${when}`, `Expiration date: ${target}`, { docId: d.id });
      await d.ref.update({ remindersSent: FieldValue.arrayUnion(...REMINDER_DAYS.filter((n) => n >= due && daysLeft <= n)) });
    }
  }
});

function localParts(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function daysBetween(fromISO: string, toISO: string) {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
