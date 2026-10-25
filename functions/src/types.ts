export type DocStatus = "processing" | "ready" | "no_date" | "failed";

export interface Extraction {
  docType: string;           // e.g. "passport", "drivers_license", "insurance_policy", "lease", "other"
  title: string;             // short human label, e.g. "Passport - USA"
  issuer: string | null;
  expirationDate: string | null; // ISO yyyy-mm-dd
  renewalDate: string | null;    // ISO yyyy-mm-dd (if distinct from expiration, e.g. renew-by date)
  confidence: number;        // 0..1 overall confidence in the dates
  notes: string | null;
}

export interface DocRecord extends Partial<Extraction> {
  status: DocStatus;
  storagePath: string;
  contentType: string;
  createdAt: FirebaseFirestore.Timestamp;
  processedAt?: FirebaseFirestore.Timestamp;
  needsReview?: boolean;
  reviewedAt?: FirebaseFirestore.Timestamp | null;
  remindersSent?: number[];  // days-before values already sent, e.g. [30, 7]
  error?: string | null;
}

export interface UserRecord {
  pushToken?: string | null;
  timezone?: string;         // IANA, defaults to UTC
  email?: string | null;
}
