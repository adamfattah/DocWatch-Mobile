import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPush(token: string | null | undefined, title: string, body: string, data: Record<string, string>) {
  if (!token || !Expo.isExpoPushToken(token)) return;
  const msg: ExpoPushMessage = { to: token, sound: "default", title, body, data };
  try {
    await expo.sendPushNotificationsAsync([msg]);
  } catch (e) {
    console.error("push failed", e);
  }
}
