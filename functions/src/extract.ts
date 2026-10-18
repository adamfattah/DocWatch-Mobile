import { GoogleGenAI, Type } from "@google/genai";
import type { Extraction } from "./types";

// Vertex AI (GCP). Set GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION via env; ADC handles auth inside Cloud Functions.
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
});

const MODEL = process.env.VISION_MODEL ?? "gemini-2.5-flash";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    docType: { type: Type.STRING },
    title: { type: Type.STRING },
    issuer: { type: Type.STRING, nullable: true },
    expirationDate: { type: Type.STRING, nullable: true, description: "ISO yyyy-mm-dd or null" },
    renewalDate: { type: Type.STRING, nullable: true, description: "ISO yyyy-mm-dd or null" },
    confidence: { type: Type.NUMBER },
    notes: { type: Type.STRING, nullable: true },
  },
  required: ["docType", "title", "confidence"],
};

const PROMPT = `You read a photo or PDF of a personal or business document and extract when it expires.
Return JSON only.
- docType: one of passport, drivers_license, id_card, visa, insurance_policy, vehicle_registration,
  warranty, lease, contract, certification, license_permit, membership, subscription, medication, other.
- title: short label a person would recognise (e.g. "Passport - USA", "Auto insurance - GEICO").
- expirationDate: the date the document stops being valid. ISO yyyy-mm-dd. Null if none visible.
- renewalDate: a distinct renew-by / next-due date if the document shows one; else null.
- If only month/year is shown, use the last day of that month.
- If the year is 2 digits, assume the nearest future-or-recent century interpretation.
- confidence: 0-1 how sure you are the dates are correct and are the expiration (not issue) dates.
  Use < 0.6 when blurry, ambiguous, or you had to guess which date is the expiry.`;

export async function extractFromFile(bytes: Buffer, mimeType: string): Promise<Extraction> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { role: "user", parts: [
        { inlineData: { mimeType, data: bytes.toString("base64") } },
        { text: PROMPT },
      ] },
    ],
    config: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
  });
  const raw = JSON.parse(res.text ?? "{}");
  return {
    docType: raw.docType ?? "other",
    title: raw.title ?? "Document",
    issuer: raw.issuer ?? null,
    expirationDate: validDate(raw.expirationDate),
    renewalDate: validDate(raw.renewalDate),
    confidence: clamp(Number(raw.confidence ?? 0)),
    notes: raw.notes ?? null,
  };
}

function validDate(s: unknown): string | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return isNaN(Date.parse(s)) ? null : s;
}
const clamp = (n: number) => (isNaN(n) ? 0 : Math.max(0, Math.min(1, n)));
