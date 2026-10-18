import Constants from "expo-constants";
import { initializeApp, getApps } from "firebase/app";
// Metro resolves the react-native build at runtime; the browser typings just do not declare it.
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const cfg = Constants.expoConfig?.extra?.firebase;
export const app = getApps()[0] ?? initializeApp(cfg);
export const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
export const db = getFirestore(app);
export const storage = getStorage(app);
