export type DocStatus = "processing" | "ready" | "no_date" | "failed";

export interface Doc {
  id: string;
  status: DocStatus;
  title?: string;
  docType?: string;
  issuer?: string | null;
  holderName?: string | null;
  documentNumberLast4?: string | null;
  expirationDate?: string | null;
  renewalDate?: string | null;
  confidence?: number;
  needsReview?: boolean;
  storagePath: string;
  contentType: string;
  error?: string | null;
  remindersSent?: number[];
  customReminderAt?: { seconds: number } | null;
  customReminderSentAt?: { seconds: number } | null;
  createdAt?: { seconds: number };
}

export interface UserSettings {
  email?: string | null;
  timezone?: string;
  pushToken?: string | null;
  reminderDays?: number;        // 7 | 14 | 30 | 60 | 90
  reminderTime?: string;        // "HH:MM"
  notificationsEnabled?: boolean;
  requireFaceId?: boolean;
  notificationPrompted?: boolean;
}

export type RootStackParamList = {
  Tabs: undefined;
  Document: { docId: string };
};

export type TabParamList = {
  Upcoming: undefined;
  Documents: undefined;
  Shared: undefined;
  Settings: undefined;
};
