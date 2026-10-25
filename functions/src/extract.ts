import OpenAI from "openai";
import type { Extraction } from "./types";

// OpenAI vision. The API key comes from the OPENAI_API_KEY secret (Secret Manager) bound in index.ts.
const MODEL = process.env.VISION_MODEL ?? "gpt-4.1-mini";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    docType: { type: "string" },
    title: { type: "string" },
    issuer: { type: ["string", "null"] },
    expirationDate: { type: ["string", "null"], description: "ISO yyyy-mm-dd or null" },
    renewalDate: { type: ["string", "null"], description: "ISO yyyy-mm-dd or null" },
    confidence: { type: "number" },
    notes: { type: ["string", "null"] },
  },
  required: ["docType", "title", "issuer", "expirationDate", "renewalDate", "confidence", "notes"],
} as const;

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

let client: OpenAI | null = null;
const getClient = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

export async function extractFromFile(bytes: Buffer, mimeType: string): Promise<Extraction> {
  const b64 = bytes.toString("base64");
  const filePart: OpenAI.Chat.Completions.ChatCompletionContentPart =
    mimeType === "application/pdf"
      ? { type: "file", file: { filename: "document.pdf", file_data: `data:application/pdf;base64,${b64}` } }
      : { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}`, detail: "high" } };

  const res = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [{ role: "user", content: [filePart, { type: "text", text: PROMPT }] }],
    response_format: { type: "json_schema", json_schema: { name: "extraction", strict: true, schema: SCHEMA } },
  });
  const raw = JSON.parse(res.choices[0]?.message?.content ?? "{}");
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
