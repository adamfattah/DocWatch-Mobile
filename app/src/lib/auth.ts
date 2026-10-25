import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  OAuthProvider, GoogleAuthProvider, signInWithCredential,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "../firebase";
import { writeLockFlag } from "./lock";

const extra = Constants.expoConfig?.extra ?? {};
let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({ webClientId: extra.googleWebClientId, iosClientId: extra.googleIosClientId });
  googleConfigured = true;
}

export async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const res = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    nonce: hashed,
  });
  if (!res.identityToken) throw new Error("Apple did not return an identity token.");
  const cred = new OAuthProvider("apple.com").credential({ idToken: res.identityToken, rawNonce });
  return signInWithCredential(auth, cred);
}

export async function signInWithGoogle() {
  configureGoogle();
  const res: any = await GoogleSignin.signIn();
  if (res?.type === "cancelled") return;
  const idToken = res?.data?.idToken ?? res?.idToken;
  if (!idToken) throw new Error("Google did not return an ID token.");
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

// Email: sign in, or auto-create the account if it doesn't exist (no separate sign-up).
export async function signInWithEmail(email: string, password: string) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (e: any) {
    if (e?.code !== "auth/user-not-found" && e?.code !== "auth/invalid-credential") throw e;
    try {
      return await createUserWithEmailAndPassword(auth, email, password);
    } catch (e2: any) {
      if (e2?.code === "auth/email-already-in-use") throw new Error("Wrong password for this email.");
      throw e2;
    }
  }
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

export async function signOut() {
  try { configureGoogle(); await GoogleSignin.signOut(); } catch {}
  await writeLockFlag(false); // the Face ID lock is per account; the next sign-in starts unlocked
  await fbSignOut(auth);
}
