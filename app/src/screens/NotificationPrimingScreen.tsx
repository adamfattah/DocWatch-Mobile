import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../lib/settings";
import { requestNotifications, syncPushToken } from "../lib/notifications";
import { colors, radius, type } from "../theme";

// Shown once after first sign-in (mockup 02). "Allow" triggers the iOS prompt; the choice lands in Settings.
export default function NotificationPrimingScreen() {
  const { update, uid } = useSettings();
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    setBusy(true);
    try {
      const granted = await requestNotifications();
      await update({ notificationPrompted: true, notificationsEnabled: granted });
      if (granted) syncPushToken(uid).catch(() => {});
    } finally { setBusy(false); }
  };
  const notNow = () => update({ notificationPrompted: true, notificationsEnabled: false });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.step}>STEP 2 OF 2</Text>
        <Text style={s.title}>Turn on notifications</Text>
        <Text style={s.sub}>Reminders arrive as notifications. Without them, DocWatch can only show due dates inside the app.</Text>

        <View style={s.sample}>
          <View style={s.appIcon}><Ionicons name="document-text" size={18} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <View style={s.sampleTop}><Text style={s.sampleTitle}>Auto Insurance</Text><Text style={s.sampleNow}>now</Text></View>
            <Text style={s.sampleBody}>Expires in 30 days, on Oct 30. Tap to review renewal options.</Text>
          </View>
        </View>
      </View>

      <View style={s.actions}>
        <Pressable style={[s.primary, busy && { opacity: 0.6 }]} onPress={allow} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Allow Notifications</Text>}
        </Pressable>
        <Pressable onPress={notNow} hitSlop={10} disabled={busy}><Text style={s.link}>Not Now</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  step: { ...type.eyebrow, color: colors.accent },
  title: { ...type.title, color: colors.text, marginTop: 6 },
  sub: { ...type.subline, color: colors.textSecondary, marginTop: 8, lineHeight: 21 },
  sample: { flexDirection: "row", gap: 12, backgroundColor: colors.card, borderRadius: 16, padding: 14, marginTop: 28, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  appIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  sampleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sampleTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  sampleNow: { fontSize: 12, color: colors.textTertiary },
  sampleBody: { fontSize: 14, color: colors.text, marginTop: 2, lineHeight: 19 },
  actions: { paddingHorizontal: 24, paddingBottom: 16, gap: 18, alignItems: "center" },
  primary: { alignSelf: "stretch", height: 52, borderRadius: radius.card, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  link: { ...type.body, color: colors.accent },
});
