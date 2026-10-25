import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import * as Notifications from "expo-notifications";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// Saves timezone (for 9am sends) and, on a real device with permission, the Expo push token.
export async function registerForPush(uid: string, email: string | null) {
  const timezone = Localization.getCalendars()[0]?.timeZone ?? "UTC";
  let pushToken: string | null = null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (Device.isDevice && projectId && !String(projectId).startsWith("YOUR_")) {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status === "granted") pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  }

  await setDoc(doc(db, "users", uid), { timezone, email: email ?? null, ...(pushToken ? { pushToken } : {}) }, { merge: true });
}
