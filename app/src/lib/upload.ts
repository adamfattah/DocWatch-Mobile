import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
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

const extFor = (mime: string) => (mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/heic" ? "heic" : "jpg");

// Create the "processing" record first, then upload; the Storage trigger fills in the rest.
export async function uploadDocument(uid: string, picked: Picked) {
  const docRef = doc(collection(db, "users", uid, "docs"));
  const storagePath = `users/${uid}/docs/${docRef.id}/original.${extFor(picked.mimeType)}`;
  await setDoc(docRef, { status: "processing", storagePath, contentType: picked.mimeType, createdAt: serverTimestamp() });
  const blob = await (await fetch(picked.uri)).blob();
  await uploadBytes(ref(storage, storagePath), blob, { contentType: picked.mimeType });
  return docRef.id;
}
