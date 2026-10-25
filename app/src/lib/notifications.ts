import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import * as Notifications from "expo-notifications";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const projectId = (): string | null => {
  const id = Constants.expoConfig?.extra?.eas?.projectId;
  return id && !String(id).startsWith("YOUR_") ? String(id) : null;
};

/** Saves timezone and email, and refreshes the push token when permission is already granted. Never prompts. */
export async function saveProfile(uid: string, email: string | null) {
  const timezone = Localization.getCalendars()[0]?.timeZone ?? "UTC";
  await setDoc(doc(db, "users", uid), { timezone, email: email ?? null }, { merge: true });
  await syncPushToken(uid);
}

/** Stores the Expo push token if we have permission and an EAS project id; otherwise does nothing (push arrives in a later step). */
export async function syncPushToken(uid: string) {
  const id = projectId();
  if (!Device.isDevice || !id) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await setDoc(doc(db, "users", uid), { pushToken: token }, { merge: true });
  } catch (e: any) {
    console.warn("push token unavailable", e?.code ?? "");
  }
}

/** Shows the iOS permission prompt (once; iOS remembers). Returns whether notifications are allowed. */
export async function requestNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export const notificationsAllowed = async () => (await Notifications.getPermissionsAsync()).granted;
