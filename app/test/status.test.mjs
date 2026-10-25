// Run with: npm test  (Node 22+ strips types from the imported .ts files)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bucketFor, statusLine, daysUntil, governingDate, categoryFor, defaultBucket, countBuckets,
  shortDate, longDate, eyebrowDate, defaultReminder, subtitleFor, rowDate,
} from "../src/lib/status.ts";

const today = "2026-10-16";
const ready = (expirationDate, renewalDate = null) => ({ status: "ready", expirationDate, renewalDate });

test("daysUntil counts whole days, negative in the past", () => {
  assert.equal(daysUntil("2026-10-30", today), 14);
  assert.equal(daysUntil("2026-10-10", today), -6);
  assert.equal(daysUntil("2026-10-16", today), 0);
  assert.equal(daysUntil(null, today), null);
  assert.equal(daysUntil("bad", today), null);
});

test("bucketFor puts docs in the right tile", () => {
  assert.equal(bucketFor(ready("2026-10-10"), today), "expired");
  assert.equal(bucketFor(ready("2026-10-30"), today), "soon30");
  assert.equal(bucketFor(ready("2026-11-15"), today), "soon30"); // day 30
  assert.equal(bucketFor(ready("2026-11-16"), today), "soon90");
  assert.equal(bucketFor(ready("2027-01-14"), today), "soon90"); // day 90
  assert.equal(bucketFor(ready("2027-01-15"), today), "good");
  assert.equal(bucketFor({ status: "no_date" }, today), "none");
});

test("governingDate picks the earlier of expiration and renewal", () => {
  assert.deepEqual(governingDate(ready("2029-03-02", "2026-12-01")), { iso: "2026-12-01", kind: "renewal" });
  assert.deepEqual(governingDate(ready("2026-10-30", "2027-01-01")), { iso: "2026-10-30", kind: "expiration" });
  assert.deepEqual(governingDate(ready(null, "2026-12-01")), { iso: "2026-12-01", kind: "renewal" });
  assert.equal(governingDate(ready(null)), null);
});

test("statusLine copy matches the mockups", () => {
  assert.deepEqual(statusLine(ready("2026-10-30"), today), { text: "Expires in 14 days", color: "#FF9500" });
  assert.deepEqual(statusLine(ready("2026-10-10"), today), { text: "Expired 6 days ago", color: "#FF3B30" });
  assert.deepEqual(statusLine(ready("2029-03-02"), today), { text: "Valid until Mar 2, 2029", color: "#34C759" });
  assert.deepEqual(statusLine(ready(null, "2026-12-01"), today), { text: "Renewal due in 46 days", color: "#1A5CFF" });
  assert.equal(statusLine(ready("2026-12-31"), today).text, "Expires in 76 days");
  assert.equal(statusLine(ready("2026-10-16"), today).text, "Expires today");
  assert.equal(statusLine(ready("2026-10-17"), today).text, "Expires tomorrow");
  assert.equal(statusLine(ready("2026-10-15"), today).text, "Expired 1 day ago");
  assert.equal(statusLine({ status: "processing" }, today).text, "Reading...");
  assert.equal(statusLine({ status: "failed" }, today).color, "#FF3B30");
  assert.deepEqual(statusLine({ status: "no_date" }, today), { text: "No expiration date", color: "#8E8E93" });
});

test("dates format like the mockups", () => {
  assert.equal(shortDate("2026-10-30"), "Oct 30");
  assert.equal(longDate("2029-03-02"), "Mar 2, 2029");
  assert.equal(eyebrowDate(new Date(2026, 9, 16)), "FRIDAY, OCTOBER 16");
  assert.equal(rowDate(ready("2029-03-02", "2026-12-01")), "Dec 1");
});

test("categories map docType to label, icon and colour", () => {
  assert.equal(categoryFor("passport").label, "Passport");
  assert.equal(categoryFor("visa").key, "passport");
  assert.equal(categoryFor("insurance_policy").label, "Insurance Policy");
  assert.equal(categoryFor("lease").icon, "home");
  assert.equal(categoryFor("vehicle_registration").color, "#30B0C7");
  assert.equal(categoryFor("health_card").label, "Health Card");
  assert.equal(categoryFor("drivers_license").label, "Driver's License");
  assert.equal(categoryFor("warranty").key, "other");
  assert.equal(categoryFor(undefined).key, "other");
});

test("tiles: counts and the default selection is the most urgent non-empty", () => {
  const docs = [ready("2026-10-10"), ready("2026-10-30"), ready("2026-11-20"), ready("2026-12-31"), ready("2029-03-02"), { status: "processing" }, { status: "failed" }];
  const counts = countBuckets(docs, today);
  assert.deepEqual(counts, { expired: 1, soon30: 1, soon90: 2, good: 1, none: 0 });
  assert.equal(defaultBucket(counts), "expired");
  assert.equal(defaultBucket({ expired: 0, soon30: 0, soon90: 2, good: 1, none: 0 }), "soon90");
  assert.equal(defaultBucket({ expired: 0, soon30: 0, soon90: 0, good: 0, none: 0 }), "expired");
});

test("default reminder is 30 days before at 9:00 AM", () => {
  const r = defaultReminder({ ...ready("2026-10-30"), remindersSent: [30] }, today);
  assert.equal(r.iso, "2026-09-30");
  assert.equal(r.when, "Sep 30, 2026 at 9:00 AM");
  assert.equal(r.state, "sent");
  assert.equal(defaultReminder(ready("2026-12-31"), today).state, "scheduled");
  assert.equal(defaultReminder(ready("2026-10-30"), today).state, "missed");
  assert.equal(defaultReminder(ready(null), today), null);
});

test("subtitle masks the document number", () => {
  assert.equal(subtitleFor("Geico", "4417"), "Geico · •••• 4417");
  assert.equal(subtitleFor("Geico", null), "Geico");
  assert.equal(subtitleFor(null, "4417"), "•••• 4417");
  assert.equal(subtitleFor(null, null), "");
});
