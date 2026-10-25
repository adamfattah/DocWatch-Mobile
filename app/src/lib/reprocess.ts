import { Alert } from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

// Re-runs extraction on the file already in Storage; no re-upload.
export async function tryAgain(docId: string) {
  try {
    const { data } = await httpsCallable<{ docId: string }, { status: string }>(functions, "reprocessDoc")({ docId });
    if (data.status === "failed") Alert.alert("Still couldn't read it", "Try a clearer, well-lit photo of the whole document.");
  } catch (e: any) {
    Alert.alert("Couldn't try again", e?.message ?? "Please check your connection.");
  }
}
