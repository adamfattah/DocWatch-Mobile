export type DocStatus = "processing" | "ready" | "no_date" | "failed";

export interface Doc {
  id: string;
  status: DocStatus;
  title?: string;
  docType?: string;
  issuer?: string | null;
  expirationDate?: string | null;
  renewalDate?: string | null;
  confidence?: number;
  needsReview?: boolean;
  storagePath: string;
  contentType: string;
  error?: string | null;
  createdAt?: { seconds: number };
}

export type RootStackParamList = {
  Home: undefined;
  Review: { docId: string };
};
