import { Alert } from "react-native";
import { httpsCallable } from "firebase/functions";
import { ref, getDownloadURL } from "firebase/storage";
import { EmailAuthProvider, GoogleAuthProvider, OAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { auth, functions, storage } from "../firebase";
import { signOut } from "./auth";
import { writeLockFlag } from "./lock";

type ExportResult = { url: string | null; path: string; expiresAt: number; count: number };

/** Builds the export on the server, downloads the zip to the cache, and opens the share sheet. */
export async function exportMyData() {
  const { data } = await httpsCallable<unknown, ExportResult>(functions, "exportData")({});
  const url = data.url ?? (await getDownloadURL(ref(storage, data.path)));
  const target = `${FileSystem.cacheDirectory}docwatch-export.zip`;
  const res = await FileSystem.downloadAsync(url, target);
  if (res.status >= 400) throw new Error(`Download failed (${res.status})`);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(res.uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: "DocWatch export" });
  return data.count;
}

/** Re-authenticates with whichever provider the user signed in with; needed before account deletion. */
async function reauthenticate(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const provider = user.providerData[0]?.providerId;
  if (provider === "google.com") {
    const res: any = await GoogleSignin.signIn();
    if (res?.type === "cancelled") return false;
    const idToken = res?.data?.idToken ?? res?.idToken;
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
    return true;
  }
  if (provider === "apple.com") {
    const rawNonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const res = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce: hashed });
    if (!res.identityToken) return false;
    await reauthenticateWithCredential(user, new OAuthProvider("apple.com").credential({ idToken: res.identityToken, rawNonce }));
    return true;
  }
  // Email/password: ask for the password.
  const password = await new Promise<string | null>((resolve) =>
    Alert.prompt("Confirm your password", "For your security, enter your password to continue.",
      [{ text: "Cancel", style: "cancel", onPress: () => resolve(null) }, { text: "Continue", onPress: (v?: string) => resolve(v ?? null) }],
      "secure-text"));
  if (!password) return false;
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
  return true;
}

/** Calls deleteAccount; on the recent-login requirement, re-authenticates once and retries. Signs out afterwards. */
export async function deleteMyAccount(): Promise<boolean> {
  const call = httpsCallable<unknown, { ok: boolean }>(functions, "deleteAccount");
  try {
    await call({});
  } catch (e: any) {
    if (e?.code !== "functions/failed-precondition") throw e;
    if (!(await reauthenticate())) return false;
    await call({});
  }
  await writeLockFlag(false);
  await signOut().catch(() => {});
  return true;
}
