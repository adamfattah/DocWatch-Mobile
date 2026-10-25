// Run with: npm test (in functions/). Node strips the types from ../src/reminders.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueDefaultReminder, customReminderDue, stagesFor, localParts, settingsOf, defaultMessage } from "../src/reminders.ts";

const utc = (iso) => new Date(iso);
const doc = (expirationDate, remindersSent = [], extra = {}) => ({ status: "ready", title: "Doc", expirationDate, remindersSent, ...extra });
const ny = { timezone: "America/New_York", reminderTime: "09:00" };

test("stages: default days plus 7/1/0, de-duplicated and descending", () => {
  assert.deepEqual(stagesFor(30), [30, 7, 1, 0]);
  assert.deepEqual(stagesFor(60), [60, 7, 1, 0]);
  assert.deepEqual(stagesFor(7), [7, 1, 0]);
});

test("settings fall back to 30 days, 09:00, UTC, enabled", () => {
  assert.deepEqual(settingsOf(undefined), { days: 30, time: "09:00", timezone: "UTC", enabled: true });
  assert.equal(settingsOf({ reminderDays: 45 }).days, 30);           // not an allowed option
  assert.equal(settingsOf({ reminderTime: "9am" }).time, "09:00");   // malformed
  assert.equal(settingsOf({ notificationsEnabled: false }).enabled, false);
});

test("default 30 days vs 60 days: first reminder day differs", () => {
  // 2026-10-16 09:30 New York = 13:30Z. Doc expires 2026-12-15 = 60 days out.
  const now = utc("2026-10-16T13:30:00Z");
  assert.equal(dueDefaultReminder(doc("2026-12-15"), { ...ny, reminderDays: 30 }, now), null);
  const d60 = dueDefaultReminder(doc("2026-12-15"), { ...ny, reminderDays: 60 }, now);
  assert.equal(d60.stage, 60); assert.equal(d60.daysLeft, 60); assert.deepEqual(d60.markSent, [60]);
  // 30 days out: the 30-day user gets it now.
  const d30 = dueDefaultReminder(doc("2026-11-15"), { ...ny, reminderDays: 30 }, now);
  assert.equal(d30.stage, 30);
});

test("custom reminder time: nothing before it, due at or after it", () => {
  const d = doc("2026-11-15");
  const s = { ...ny, reminderDays: 30, reminderTime: "18:30" };
  assert.equal(dueDefaultReminder(d, s, utc("2026-10-16T22:29:00Z")), null); // 18:29 NY
  assert.ok(dueDefaultReminder(d, s, utc("2026-10-16T22:30:00Z")));          // 18:30 NY
  assert.ok(dueDefaultReminder(d, s, utc("2026-10-17T02:00:00Z")));          // 22:00 NY same day
});

test("missed-day catch-up sends the most urgent due stage once and marks the earlier ones", () => {
  const now = utc("2026-10-16T13:30:00Z");
  // 28 days left, nothing sent: the 30-day stage is overdue -> send it.
  const a = dueDefaultReminder(doc("2026-11-13"), { ...ny, reminderDays: 30 }, now);
  assert.equal(a.stage, 30); assert.deepEqual(a.markSent, [30]);
  // 5 days left, nothing sent (device offline for weeks): send the 7-day one, mark 30 and 7.
  const b = dueDefaultReminder(doc("2026-10-21"), { ...ny, reminderDays: 30 }, now);
  assert.equal(b.stage, 7); assert.deepEqual(b.markSent, [30, 7]);
  // Day of expiry, nothing sent: one message, all stages marked.
  const c = dueDefaultReminder(doc("2026-10-16"), { ...ny, reminderDays: 30 }, now);
  assert.equal(c.stage, 0); assert.deepEqual(c.markSent, [30, 7, 1, 0]);
  // Past expiry: nothing.
  assert.equal(dueDefaultReminder(doc("2026-10-15"), { ...ny, reminderDays: 30 }, now), null);
});

test("already sent stages are not repeated", () => {
  const now = utc("2026-10-16T13:30:00Z");
  assert.equal(dueDefaultReminder(doc("2026-11-13", [30]), { ...ny, reminderDays: 30 }, now), null);
  const d = dueDefaultReminder(doc("2026-10-21", [30]), { ...ny, reminderDays: 30 }, now);
  assert.equal(d.stage, 7); assert.deepEqual(d.markSent, [7]);
  assert.equal(dueDefaultReminder(doc("2026-10-21", [30, 7]), { ...ny, reminderDays: 30 }, now), null);
});

test("notifications off or doc not ready: nothing is sent", () => {
  const now = utc("2026-10-16T13:30:00Z");
  assert.equal(dueDefaultReminder(doc("2026-11-13"), { ...ny, notificationsEnabled: false }, now), null);
  assert.equal(dueDefaultReminder({ ...doc("2026-11-13"), status: "processing" }, ny, now), null);
  assert.equal(dueDefaultReminder({ ...doc("2026-11-13"), status: "no_date", expirationDate: null }, ny, now), null);
  assert.equal(customReminderDue(doc(null, [], { customReminderAt: utc("2026-10-16T13:00:00Z") }), { notificationsEnabled: false }, now), false);
});

test("timezone: the same instant is a different local day and time", () => {
  // 2026-10-16 23:30Z = Oct 16 19:30 New York, Oct 17 08:30 Tokyo (before 09:00), Oct 17 10:30 Sydney.
  const now = utc("2026-10-16T23:30:00Z");
  const d = doc("2026-11-16"); // 31 days from Oct 16, 30 days from Oct 17
  assert.equal(dueDefaultReminder(d, { timezone: "America/New_York" }, now), null);     // 31 days left in NY
  assert.equal(dueDefaultReminder(d, { timezone: "Asia/Tokyo" }, now), null);           // 30 days left but 08:30 < 09:00
  assert.equal(dueDefaultReminder(d, { timezone: "Australia/Sydney" }, now).stage, 30);  // 30 days left, 10:30
  assert.deepEqual(localParts(now, "Asia/Tokyo"), { date: "2026-10-17", minutes: 510 });
  assert.deepEqual(localParts(now, "Not/AZone"), { date: "2026-10-16", minutes: 1410 }); // bad tz -> UTC
});

test("DST edges: 09:00 local stays 09:00 local when clocks change", () => {
  const d = doc("2026-12-01");
  // US DST ends 2026-11-01: 09:00 EST = 14:00Z (not 13:00Z).
  assert.equal(dueDefaultReminder(d, ny, utc("2026-11-01T13:30:00Z")), null);
  assert.ok(dueDefaultReminder(d, ny, utc("2026-11-01T14:00:00Z")));
  // US DST starts 2026-03-08: 09:00 EDT = 13:00Z (not 14:00Z).
  const spring = doc("2026-04-01");
  assert.equal(dueDefaultReminder(spring, ny, utc("2026-03-08T12:45:00Z")), null);
  assert.ok(dueDefaultReminder(spring, ny, utc("2026-03-08T13:00:00Z")));
  // Europe/London: BST ends 2026-10-25; 09:00 GMT = 09:00Z.
  assert.equal(dueDefaultReminder(doc("2026-11-20"), { timezone: "Europe/London" }, utc("2026-10-25T08:30:00Z")), null);
  assert.ok(dueDefaultReminder(doc("2026-11-20"), { timezone: "Europe/London" }, utc("2026-10-25T09:00:00Z")));
});

test("custom reminder fires once at its instant and re-arms when the sent mark is cleared", () => {
  const at = utc("2026-10-20T15:00:00Z");
  const d = doc("2026-12-01", [], { customReminderAt: at });
  assert.equal(customReminderDue(d, ny, utc("2026-10-20T14:59:00Z")), false);
  assert.equal(customReminderDue(d, ny, utc("2026-10-20T15:00:00Z")), true);
  assert.equal(customReminderDue({ ...d, customReminderSentAt: at }, ny, utc("2026-10-21T15:00:00Z")), false);
  assert.equal(customReminderDue({ ...d, customReminderSentAt: null }, ny, utc("2026-10-21T15:00:00Z")), true);
  assert.equal(customReminderDue(doc("2026-12-01"), ny, utc("2026-10-21T15:00:00Z")), false);
});

test("message copy", () => {
  assert.deepEqual(defaultMessage(doc("2026-10-30"), { stage: 30, daysLeft: 14, target: "2026-10-30", markSent: [30] }), { title: "Doc expires in 14 days", body: "Expiration date: 2026-10-30" });
  assert.equal(defaultMessage(doc("2026-10-30"), { stage: 0, daysLeft: 0, target: "2026-10-30", markSent: [] }).title, "Doc expires today");
  assert.equal(defaultMessage(doc("2026-10-30"), { stage: 1, daysLeft: 1, target: "2026-10-30", markSent: [] }).title, "Doc expires tomorrow");
});
