import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Require Face ID: lock on cold launch and after 60 s in the background, with passcode fallback.
// The flag is cached on-device so the lock is in place before Firestore has loaded.
const KEY = "docwatch.requireFaceId";
const BACKGROUND_GRACE_MS = 60_000;

export const readLockFlag = async () => { try { return (await AsyncStorage.getItem(KEY)) === "1"; } catch { return false; } };
export const writeLockFlag = async (on: boolean) => { try { on ? await AsyncStorage.setItem(KEY, "1") : await AsyncStorage.removeItem(KEY); } catch {} };

export async function biometricsAvailable(): Promise<{ ok: boolean; reason?: string }> {
  if (!(await LocalAuthentication.hasHardwareAsync())) return { ok: false, reason: "This device has no Face ID or Touch ID." };
  if (!(await LocalAuthentication.isEnrolledAsync())) return { ok: false, reason: "Set up Face ID or a passcode in iOS Settings first." };
  return { ok: true };
}

export async function authenticate(prompt = "Unlock DocWatch"): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, fallbackLabel: "Use Passcode", disableDeviceFallback: false, cancelLabel: "Cancel" });
  return r.success;
}

type Ctx = { locked: boolean; unlock: () => Promise<boolean>; setEnabled: (on: boolean) => Promise<void> };
const LockCtx = createContext<Ctx>({ locked: false, unlock: async () => true, setEnabled: async () => {} });

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const enabled = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  const authInFlight = useRef(false);

  const unlock = useCallback(async () => {
    if (authInFlight.current) return false;
    authInFlight.current = true;
    try {
      const ok = await authenticate();
      if (ok) setLocked(false);
      return ok;
    } finally { authInFlight.current = false; }
  }, []);

  // Cold launch.
  useEffect(() => {
    readLockFlag().then((on) => { enabled.current = on; if (on) { setLocked(true); unlock(); } });
  }, [unlock]);

  // Background for more than the grace period.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background") backgroundedAt.current = Date.now();
      if (state === "active") {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (enabled.current && away >= BACKGROUND_GRACE_MS) { setLocked(true); unlock(); }
      }
    });
    return () => sub.remove();
  }, [unlock]);

  const setEnabled = useCallback(async (on: boolean) => { enabled.current = on; await writeLockFlag(on); }, []);

  return <LockCtx.Provider value={{ locked, unlock, setEnabled }}>{children}</LockCtx.Provider>;
}

export const useLock = () => useContext(LockCtx);
