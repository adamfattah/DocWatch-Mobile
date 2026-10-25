import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";

export interface Picked { uri: string; mimeType: string }

function fromImage(r: ImagePicker.ImagePickerResult): Picked | null {
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" };
}

export async function pickFromCamera(): Promise<Picked | null> {
  const p = await ImagePicker.requestCameraPermissionsAsync();
  if (!p.granted) throw new Error("Camera permission is off. Enable it in Settings.");
  return fromImage(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 }));
}

export async function pickFromLibrary(): Promise<Picked | null> {
  return fromImage(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 }));
}

export async function pickFile(): Promise<Picked | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? (a.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg") };
}

const MAX_LONG_EDGE = 2400;
const JPEG_QUALITY = 0.8;

// Every picked image becomes a JPEG before upload. iPhone photos are HEIC, which the AI vision API rejects,
// and capping the long edge keeps uploads small without hurting legibility.
async function toJpeg(picked: Picked): Promise<Picked> {
  const ctx = ImageManipulator.manipulate(picked.uri);
  const probe = await ctx.renderAsync();
  const { width, height } = probe;
  probe.release();
  if (Math.max(width, height) > MAX_LONG_EDGE) ctx.resize(width >= height ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  img.release();
  return { uri: out.uri, mimeType: "image/jpeg" };
}

const extFor = (mime: string) => (mime === "application/pdf" ? "pdf" : "jpg");

// Create the "processing" record first, then upload; the Storage trigger fills in the rest.
export async function uploadDocument(uid: string, picked: Picked) {
  const file = picked.mimeType === "application/pdf" ? picked : await toJpeg(picked);
  const docRef = doc(collection(db, "users", uid, "docs"));
  const storagePath = `users/${uid}/docs/${docRef.id}/original.${extFor(file.mimeType)}`;
  await setDoc(docRef, { status: "processing", storagePath, contentType: file.mimeType, createdAt: serverTimestamp() });
  const blob = await (await fetch(file.uri)).blob();
  await uploadBytes(ref(storage, storagePath), blob, { contentType: file.mimeType });
  return docRef.id;
}
