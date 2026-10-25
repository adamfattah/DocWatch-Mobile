import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_REMINDER_DAYS, DEFAULT_REMINDER_TIME } from "./status";
import type { UserSettings } from "../types";

// users/{uid} holds the user's settings. One subscription, shared app-wide.
type Ctx = { settings: UserSettings | null; update: (patch: Partial<UserSettings>) => Promise<void>; uid: string };
const SettingsCtx = createContext<Ctx>({ settings: null, update: async () => {}, uid: "" });

export function SettingsProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  useEffect(() => onSnapshot(doc(db, "users", uid), (snap) => setSettings((snap.data() as UserSettings | undefined) ?? {}), (e) => console.warn("settings listener", e.code)), [uid]);
  const update = (patch: Partial<UserSettings>) => setDoc(doc(db, "users", uid), patch, { merge: true });
  return <SettingsCtx.Provider value={{ settings, update, uid }}>{children}</SettingsCtx.Provider>;
}

/** settings is null until the first snapshot. */
export const useSettings = () => useContext(SettingsCtx);

export const effectiveReminder = (s: UserSettings | null | undefined) => ({
  days: s?.reminderDays ?? DEFAULT_REMINDER_DAYS,
  time: s?.reminderTime ?? DEFAULT_REMINDER_TIME,
});
