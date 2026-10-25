// Pure helpers shared by Upcoming, Documents and Document detail. No React Native imports so it runs under node --test.
// Extension is explicit so node --test can resolve it; Metro and tsc (allowImportingTsExtensions) accept it too.
import { colors } from "../theme.ts";

export type Bucket = "expired" | "soon30" | "soon90" | "good" | "none";
export type CategoryKey = "passport" | "insurance" | "lease" | "vehicle" | "health" | "drivers_license" | "other";

export interface StatusDoc {
  status: "processing" | "ready" | "no_date" | "failed";
  docType?: string | null;
  expirationDate?: string | null;
  renewalDate?: string | null;
  remindersSent?: number[];
}

export interface Category { key: CategoryKey; label: string; icon: string; color: string; docType: string }

export const CATEGORIES: Category[] = [
  { key: "passport", label: "Passport", icon: "id-card", color: colors.passport, docType: "passport" },
  { key: "insurance", label: "Insurance Policy", icon: "shield-checkmark", color: colors.insurance, docType: "insurance_policy" },
  { key: "lease", label: "Lease Agreement", icon: "home", color: colors.lease, docType: "lease" },
  { key: "vehicle", label: "Vehicle Registration", icon: "car", color: colors.vehicle, docType: "vehicle_registration" },
  { key: "health", label: "Health Card", icon: "medkit", color: colors.health, docType: "health_card" },
  { key: "drivers_license", label: "Driver's License", icon: "card", color: colors.drivers_license, docType: "drivers_license" },
  { key: "other", label: "Other", icon: "document-text", color: colors.other, docType: "other" },
];

const DOC_TYPE_TO_CATEGORY: Record<string, CategoryKey> = {
  passport: "passport", visa: "passport",
  insurance_policy: "insurance",
  lease: "lease",
  vehicle_registration: "vehicle",
  health_card: "health", medication: "health",
  drivers_license: "drivers_license",
};

export function categoryFor(docType?: string | null): Category {
  const key = (docType && DOC_TYPE_TO_CATEGORY[docType]) || "other";
  return CATEGORIES.find((c) => c.key === key)!;
}

export const BUCKETS: { key: Bucket; label: string; icon: string; color: string }[] = [
  { key: "expired", label: "Expired", icon: "alert", color: colors.expired },
  { key: "soon30", label: "Within 30 days", icon: "time", color: colors.soon30 },
  { key: "soon90", label: "Within 90 days", icon: "calendar", color: colors.soon90 },
  { key: "good", label: "All good", icon: "checkmark", color: colors.good },
];

export const bucketColor = (b: Bucket) => colors[b];

// --- dates ---------------------------------------------------------------

const MS_DAY = 86400000;
const utcDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

export function parseISODate(iso?: string | null): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = utcDay(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10));
  return isNaN(t) ? null : t;
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function todayISO(now: Date = new Date()) { return toISODate(now); }

/** Whole days from `today` (ISO) to `iso`; negative when past. */
export function daysUntil(iso: string | null | undefined, today: string): number | null {
  const a = parseISODate(today), b = parseISODate(iso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_DAY);
}

/** The date that governs status: the earlier of expiration and renewal, and which one it is. */
export function governingDate(doc: Pick<StatusDoc, "expirationDate" | "renewalDate">): { iso: string; kind: "expiration" | "renewal" } | null {
  const e = parseISODate(doc.expirationDate), r = parseISODate(doc.renewalDate);
  if (e === null && r === null) return null;
  if (r !== null && (e === null || r < e)) return { iso: doc.renewalDate!, kind: "renewal" };
  return { iso: doc.expirationDate!, kind: "expiration" };
}

export function bucketFor(doc: StatusDoc, today: string): Bucket {
  const g = governingDate(doc);
  const n = g ? daysUntil(g.iso, today) : null;
  if (n === null) return "none";
  if (n < 0) return "expired";
  if (n <= 30) return "soon30";
  if (n <= 90) return "soon90";
  return "good";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Oct 30" */
export function shortDate(iso?: string | null): string {
  const t = parseISODate(iso); if (t === null) return "";
  const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
/** "Oct 30, 2026" */
export function longDate(iso?: string | null): string {
  const t = parseISODate(iso); if (t === null) return "";
  const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
/** "FRIDAY, OCTOBER 16" */
export function eyebrowDate(now: Date): string {
  return `${DAYS_LONG[now.getDay()]}, ${MONTHS_LONG[now.getMonth()]} ${now.getDate()}`.toUpperCase();
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** Colored status line under a row title, and the colour to draw it in. */
export function statusLine(doc: StatusDoc, today: string): { text: string; color: string } {
  if (doc.status === "processing") return { text: "Reading...", color: colors.none };
  if (doc.status === "failed") return { text: "Couldn't read this one", color: colors.expired };
  const g = governingDate(doc);
  const n = g ? daysUntil(g.iso, today) : null;
  if (!g || n === null) return { text: "No expiration date", color: colors.none };
  const color = bucketColor(bucketFor(doc, today));
  if (g.kind === "renewal") {
    if (n < 0) return { text: `Renewal was due ${plural(-n, "day")} ago`, color };
    if (n === 0) return { text: "Renewal due today", color };
    if (n > 90) return { text: `Renewal due ${longDate(g.iso)}`, color };
    return { text: `Renewal due in ${plural(n, "day")}`, color };
  }
  if (n < 0) return { text: `Expired ${plural(-n, "day")} ago`, color };
  if (n === 0) return { text: "Expires today", color };
  if (n === 1) return { text: "Expires tomorrow", color };
  if (n > 90) return { text: `Valid until ${longDate(g.iso)}`, color };
  return { text: `Expires in ${plural(n, "day")}`, color };
}

/** Right-hand date on a row: the governing date, short. */
export function rowDate(doc: StatusDoc): string {
  const g = governingDate(doc); return g ? shortDate(g.iso) : "";
}

/** Most urgent non-empty tile; falls back to Expired when there is nothing to show. */
export function defaultBucket(counts: Record<Bucket, number>): Bucket {
  return BUCKETS.find((b) => counts[b.key] > 0)?.key ?? "expired";
}

export function countBuckets(docs: StatusDoc[], today: string): Record<Bucket, number> {
  const c: Record<Bucket, number> = { expired: 0, soon30: 0, soon90: 0, good: 0, none: 0 };
  for (const d of docs) if (d.status === "ready" || d.status === "no_date") c[bucketFor(d, today)]++;
  return c;
}

// --- reminders -----------------------------------------------------------

export const DEFAULT_REMINDER_DAYS = 30;
export const DEFAULT_REMINDER_HOUR = 9;

/** Default reminder: N days before the governing date at 9:00 local; text like "Sep 30, 2026 at 9:00 AM". */
export function defaultReminder(doc: StatusDoc, today: string, daysBefore = DEFAULT_REMINDER_DAYS, hour = DEFAULT_REMINDER_HOUR) {
  const g = governingDate(doc);
  if (!g) return null;
  const t = parseISODate(g.iso)! - daysBefore * MS_DAY;
  const d = new Date(t);
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const h12 = ((hour + 11) % 12) + 1, ampm = hour < 12 ? "AM" : "PM";
  const sent = (doc.remindersSent ?? []).includes(daysBefore);
  const past = (daysUntil(iso, today) ?? 1) < 0;
  return { iso, when: `${longDate(iso)} at ${h12}:00 ${ampm}`, state: sent ? "sent" : past ? "missed" : "scheduled", daysBefore };
}

// --- misc ----------------------------------------------------------------

/** "Geico · •••• 4417" */
export function subtitleFor(issuer?: string | null, last4?: string | null): string {
  return [issuer, last4 ? `•••• ${last4}` : null].filter(Boolean).join(" · ");
}

export const initials = (name?: string | null) =>
  (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
