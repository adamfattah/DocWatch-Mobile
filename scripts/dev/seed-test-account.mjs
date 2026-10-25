#!/usr/bin/env node
// Dev-only. Copies every document from one account into the Simulator test account so the app can be
// tested with real files, and downloads the originals to scripts/dev/fixtures/ (gitignored).
//
//   node scripts/dev/seed-test-account.mjs --list-accounts
//   node scripts/dev/seed-test-account.mjs --from adamfattah@gmail.com --to <test-account-email>
//
// Auth: reuses the Firebase CLI's logged-in account (firebase login) through firebase-tools' own library.
// Never ships in the app. Copies only; the source account is never modified. Idempotent: docs that already
// exist in the target are skipped. Prints counts only, never document contents or names.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initAdmin, findUser, mask } from "./lib/admin.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, "fixtures");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]] : []).filter(Boolean));

const { db, bucket, auth } = initAdmin();

if (args["list-accounts"]) {
  const { users } = await auth.listUsers(50);
  for (const u of users) console.log(`${mask(u.email)}  uid ${u.uid.slice(0, 6)}…  provider ${u.providerData.map((p) => p.providerId).join(",") || "none"}`);
  process.exit(0);
}

if (!args.from || !args.to || args.from === true || args.to === true) {
  console.error("Usage: --from <source email> --to <target email>   (or --list-accounts)");
  process.exit(1);
}
if (args.from === args.to) { console.error("Source and target must differ."); process.exit(1); }

// --from / --to accept an email or a uid prefix as shown by --list-accounts.
const src = await findUser(auth, args.from);
const dst = await findUser(auth, args.to);
if (src.uid === dst.uid) { console.error("Source and target must differ."); process.exit(1); }

// --- Copy -----------------------------------------------------------------------------------------------
mkdirSync(FIXTURES, { recursive: true });
const docs = await db.collection(`users/${src.uid}/docs`).get();
let copied = 0, skipped = 0, downloaded = 0, failed = 0;

for (const d of docs.docs) {
  const data = d.data();
  const srcPath = data.storagePath;
  if (!srcPath || !srcPath.startsWith(`users/${src.uid}/docs/${d.id}/`)) { skipped++; continue; }
  const ext = srcPath.split(".").pop();
  const dstPath = `users/${dst.uid}/docs/${d.id}/${srcPath.split("/").pop()}`;
  const dstRef = db.doc(`users/${dst.uid}/docs/${d.id}`);

  // Fixture download (skip if already present).
  const local = join(FIXTURES, `${d.id}.${ext}`);
  try {
    if (!existsSync(local)) { await bucket.file(srcPath).download({ destination: local }); downloaded++; }
  } catch (e) { failed++; console.error(`download failed for doc ${d.id.slice(0, 6)}…: ${e.code ?? e.message}`); continue; }

  if ((await dstRef.get()).exists) { skipped++; continue; }

  try {
    // Record first (the Storage trigger reads storagePath from it), then the file. The trigger then
    // re-runs extraction for the target account, so it also gets the newest extraction fields.
    const record = { ...data, storagePath: dstPath, status: "processing", needsReview: false, remindersSent: [], error: null };
    delete record.processedAt; delete record.reviewedAt;
    await dstRef.set(record);
    await bucket.file(srcPath).copy(bucket.file(dstPath), { contentType: data.contentType });
    copied++;
  } catch (e) { failed++; console.error(`copy failed for doc ${d.id.slice(0, 6)}…: ${e.code ?? e.message}`); }
}

console.log(`source docs ${docs.size} | copied ${copied} | skipped (already present) ${skipped} | fixtures downloaded ${downloaded} | failed ${failed}`);
console.log(`fixtures in ${FIXTURES}`);
