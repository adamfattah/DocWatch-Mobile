// Pure reminder scheduling. No imports so it runs under node --test (functions/test/reminders.test.mjs)
// and inside Cloud Functions. All dates are ISO yyyy-mm-dd; "now" is an absolute instant.

export const DEFAULT_REMINDER_DAYS = 30;
export const DEFAULT_REMINDER_TIME = "09:00";
export const FOLLOW_UP_DAYS = [7, 1, 0];
export const REMINDER_DAY_OPTIONS = [7, 14, 30, 60, 90];

export interface ReminderSettings {
  reminderDays?: number | null;      // first reminder, days before the governing date
  reminderTime?: string | null;      // "HH:MM" local
  timezone?: string | null;          // IANA
  notificationsEnabled?: boolean | null;
}

export interface ReminderDoc {
  status: string;
  title?: string | null;
  expirationDate?: string | null;
  renewalDate?: string | null;
  remindersSent?: number[] | null;
  customReminderAt?: Date | null;
  customReminderSentAt?: Date | null;
}

export interface DueReminder { stage: number; daysLeft: number; target: string; markSent: number[] }

const MS_DAY = 86400000;

export const settingsOf = (s: ReminderSettings | undefined) => ({
  days: REMINDER_DAY_OPTIONS.includes(s?.reminderDays ?? -1) ? (s!.reminderDays as number) : DEFAULT_REMINDER_DAYS,
  time: /^\d{2}:\d{2}$/.test(s?.reminderTime ?? "") ? (s!.reminderTime as string) : DEFAULT_REMINDER_TIME,
  timezone: s?.timezone || "UTC",
  enabled: s?.notificationsEnabled !== false,
});

/** Stages for a user: their first-reminder days plus the fixed follow-ups, descending, de-duplicated. */
export function stagesFor(days: number): number[] {
  return [...new Set([days, ...FOLLOW_UP_DAYS])].sort((a, b) => b - a);
}

export const parseTime = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** Local calendar date and minutes-since-midnight for an instant in a timezone (DST-correct via Intl). */
export function localParts(now: Date, tz: string): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch {
    return localParts(now, "UTC");
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) % 24 * 60 + Number(get("minute")) };
}

export function parseISODate(iso?: string | null): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return isNaN(t) ? null : t;
}

export function daysBetween(fromISO: string, toISO: string): number | null {
  const a = parseISODate(fromISO), b = parseISODate(toISO);
  return a === null || b === null ? null : Math.round((b - a) / MS_DAY);
}

/** The date reminders count down to: the earlier of expiration and renewal. */
export function governingDate(doc: Pick<ReminderDoc, "expirationDate" | "renewalDate">): string | null {
  const e = parseISODate(doc.expirationDate), r = parseISODate(doc.renewalDate);
  if (e === null && r === null) return null;
  if (r !== null && (e === null || r < e)) return doc.renewalDate!;
  return doc.expirationDate!;
}

/**
 * Which default-schedule reminder is due right now, if any. Sends at most one message per run: the most
 * urgent unsent stage whose day has arrived (so a missed day is caught up with the latest stage, not all
 * of them), and only once the user's local time has reached their reminder time. Never after the date.
 */
export function dueDefaultReminder(doc: ReminderDoc, settings: ReminderSettings | undefined, now: Date): DueReminder | null {
  if (doc.status !== "ready") return null;
  const s = settingsOf(settings);
  if (!s.enabled) return null;
  const target = governingDate(doc);
  if (!target) return null;
  const local = localParts(now, s.timezone);
  if (local.minutes < parseTime(s.time)) return null;
  const daysLeft = daysBetween(local.date, target);
  if (daysLeft === null || daysLeft < 0) return null;
  const stages = stagesFor(s.days);
  const sent = new Set(doc.remindersSent ?? []);
  const due = stages.filter((n) => daysLeft <= n && !sent.has(n)).sort((a, b) => a - b)[0];
  if (due === undefined) return null;
  return { stage: due, daysLeft, target, markSent: stages.filter((n) => n >= due && daysLeft <= n && !sent.has(n)) };
}

/** A per-document custom reminder fires once, at or after its instant. Clearing customReminderSentAt re-arms it. */
export function customReminderDue(doc: ReminderDoc, settings: ReminderSettings | undefined, now: Date): boolean {
  if (!settingsOf(settings).enabled) return false;
  if (!doc.customReminderAt || doc.customReminderSentAt) return false;
  return doc.customReminderAt.getTime() <= now.getTime();
}

export function defaultMessage(doc: ReminderDoc, due: DueReminder): { title: string; body: string } {
  const title = doc.title || "Document";
  const when = due.daysLeft === 0 ? "expires today" : due.daysLeft === 1 ? "expires tomorrow" : `expires in ${due.daysLeft} days`;
  return { title: `${title} ${when}`, body: `Expiration date: ${due.target}` };
}

export function customMessage(doc: ReminderDoc): { title: string; body: string } {
  const title = doc.title || "Document";
  const target = governingDate(doc);
  return { title: `Reminder: ${title}`, body: target ? `Expiration date: ${target}` : "You asked to be reminded about this document." };
}
