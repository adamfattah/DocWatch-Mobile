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
  createdAt?: { seconds: number };
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
