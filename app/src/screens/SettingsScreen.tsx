import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View, ActionSheetIOS, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LargeHeader from "../components/LargeHeader";
import DatePickerSheet from "../components/DatePickerSheet";
import { Card, SectionHeader, Separator } from "../components/Card";
import { auth } from "../firebase";
import { signOut } from "../lib/auth";
import { useSettings, effectiveReminder } from "../lib/settings";
import { requestNotifications, notificationsAllowed, syncPushToken } from "../lib/notifications";
import { useLock, biometricsAvailable, authenticate } from "../lib/lock";
import { exportMyData, deleteMyAccount } from "../lib/account";
import { REMINDER_DAY_OPTIONS, formatTime, toHHMM, initials } from "../lib/status";
import { colors, type } from "../theme";

const PROVIDER_LABEL: Record<string, string> = { "apple.com": "Apple", "google.com": "Google", password: "Email" };

export default function SettingsScreen() {
  const { settings, update, uid } = useSettings();
  const lock = useLock();
  const user = auth.currentUser;
  const [timeOpen, setTimeOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [osAllowed, setOsAllowed] = useState<boolean | null>(null);
  const r = effectiveReminder(settings);

  useEffect(() => { notificationsAllowed().then(setOsAllowed); }, []);

  const name = user?.displayName || user?.email?.split("@")[0] || "You";
  const provider = PROVIDER_LABEL[user?.providerData[0]?.providerId ?? ""] ?? "Email";
  const notificationsOn = settings?.notificationsEnabled === true && osAllowed !== false;

  const pickDays = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: "Default Reminder", options: ["Cancel", ...REMINDER_DAY_OPTIONS.map((d) => `${d} days before`)], cancelButtonIndex: 0 },
      (i) => { if (i > 0) update({ reminderDays: REMINDER_DAY_OPTIONS[i - 1] }); }
    );

  const toggleNotifications = async (on: boolean) => {
    if (!on) { await update({ notificationsEnabled: false }); return; }
    const allowed = await requestNotifications();
    setOsAllowed(allowed);
    if (!allowed) {
      Alert.alert("Notifications are off in iOS Settings", "Turn them on for DocWatch to get reminders.", [
        { text: "Not now", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await update({ notificationsEnabled: true, notificationPrompted: true });
    syncPushToken(uid).catch(() => {});
  };

  const toggleFaceId = async (on: boolean) => {
    if (on) {
      const avail = await biometricsAvailable();
      if (!avail.ok) { Alert.alert("Can't turn on Face ID", avail.reason); return; }
    }
    if (!(await authenticate(on ? "Confirm to require Face ID" : "Confirm to turn off Face ID"))) return;
    await lock.setEnabled(on);
    await update({ requireFaceId: on });
  };

  const doExport = async () => {
    setBusy("export");
    try { await exportMyData(); }
    catch (e: any) { Alert.alert("Couldn't export", e?.message ?? "Please try again."); }
    finally { setBusy(null); }
  };

  const doDelete = () =>
    Alert.alert("Delete your account?", "This permanently removes your documents, files and reminders. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Continue", style: "destructive", onPress: () =>
        Alert.prompt("Type DELETE to confirm", "Your account and all its data will be deleted.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete Account", style: "destructive", onPress: async (v?: string) => {
            if ((v ?? "").trim().toUpperCase() !== "DELETE") { Alert.alert("Not deleted", "You didn't type DELETE."); return; }
            setBusy("delete");
            try { await deleteMyAccount(); }
            catch (e: any) { Alert.alert("Couldn't delete account", e?.message ?? "Please try again."); }
            finally { setBusy(null); }
          } },
        ], "plain-text") },
    ]);

  const confirmSignOut = () => Alert.alert("Sign out?", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Sign Out", style: "destructive", onPress: signOut }]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.content}>
        <LargeHeader title="Settings" />

        <Card style={s.profile}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials(name) || "?"}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.sub}>Signed in with {provider}</Text>
            {!!user?.email && <Text style={s.sub}>{user.email}</Text>}
          </View>
        </Card>

        <SectionHeader>Reminders</SectionHeader>
        <Card>
          <Row icon="notifications" color={colors.danger} label="Default Reminder" value={`${r.days} days before`} onPress={pickDays} chevron />
          <Separator />
          <Row icon="time" color={colors.soon30} label="Reminder Time" onPress={() => setTimeOpen(true)}
            right={<View style={s.timeBox}><Text style={s.timeText}>{formatTime(r.time)}</Text><Ionicons name="time-outline" size={16} color={colors.textSecondary} /></View>} />
          <Separator />
          <Row icon="notifications-circle" color={colors.danger} label="Notifications"
            right={<Switch value={notificationsOn} onValueChange={toggleNotifications} trackColor={{ true: colors.good }} />} />
        </Card>
        <Text style={s.footer}>Applies to every document without a custom reminder.</Text>

        <SectionHeader>Privacy & Security</SectionHeader>
        <Card>
          <Row icon="scan" color={colors.good} label="Require Face ID"
            right={<Switch value={settings?.requireFaceId === true} onValueChange={toggleFaceId} trackColor={{ true: colors.good }} />} />
          <Separator />
          <Row icon="download" color={colors.textTertiary} label="Export My Data" onPress={doExport} chevron
            right={busy === "export" ? <ActivityIndicator /> : undefined} />
          <Separator />
          <Row icon="trash" color={colors.danger} label="Delete Account" onPress={doDelete} chevron
            right={busy === "delete" ? <ActivityIndicator /> : undefined} />
        </Card>

        <Card style={{ marginTop: 24 }}>
          <Pressable style={s.signOutRow} onPress={confirmSignOut}><Text style={s.signOut}>Sign Out</Text></Pressable>
        </Card>
      </ScrollView>

      <DatePickerSheet
        visible={timeOpen}
        title="Reminder Time"
        mode="time"
        value={(() => { const d = new Date(); const [h, m] = r.time.split(":").map(Number); d.setHours(h, m, 0, 0); return d; })()}
        onConfirm={(d) => { update({ reminderTime: toHHMM(d) }); setTimeOpen(false); }}
        onCancel={() => setTimeOpen(false)}
      />
    </SafeAreaView>
  );
}

function Row({ icon, color, label, value, right, chevron, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; label: string; value?: string; right?: React.ReactNode; chevron?: boolean; onPress?: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && onPress && { backgroundColor: "#F7F7F9" }]} onPress={onPress} disabled={!onPress}>
      <View style={[s.icon, { backgroundColor: color }]}><Ionicons name={icon} size={15} color="#fff" /></View>
      <Text style={s.label}>{label}</Text>
      {!!value && <Text style={s.value}>{value}</Text>}
      {right}
      {chevron && !right && <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  name: { ...type.rowTitle, color: colors.text },
  sub: { ...type.caption, color: colors.textTertiary, marginTop: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 46, backgroundColor: colors.card },
  icon: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  label: { ...type.body, color: colors.text, flex: 1 },
  value: { ...type.body, color: colors.textTertiary },
  timeBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEEEF2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  timeText: { fontSize: 15, color: colors.text },
  footer: { ...type.caption, color: colors.textTertiary, marginTop: 8, marginLeft: 16 },
  signOutRow: { height: 48, alignItems: "center", justifyContent: "center" },
  signOut: { ...type.body, color: colors.danger },
});
