import React, { useEffect, useLayoutEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, ActionSheetIOS, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, deleteObject, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useDocs } from "../lib/docs";
import { tryAgain } from "../lib/reprocess";
import { downloadAndShare } from "../lib/files";
import {
  CATEGORIES, categoryFor, statusLine, longDate, defaultReminder, subtitleFor, todayISO, parseISODate, toISODate,
} from "../lib/status";
import FilePreview from "../components/FilePreview";
import DatePickerSheet from "../components/DatePickerSheet";
import { Card, SectionHeader, Separator } from "../components/Card";
import { colors, radius, tint, type } from "../theme";
import type { Doc, RootStackParamList } from "../types";

type Editable = Partial<Pick<Doc, "title" | "docType" | "holderName" | "expirationDate" | "renewalDate">>;

export default function DocumentDetailScreen({ uid }: { uid: string }) {
  const { params } = useRoute<RouteProp<RootStackParamList, "Document">>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const docs = useDocs();
  const d = docs?.find((x) => x.id === params.docId);
  const today = todayISO();
  const [holder, setHolder] = useState<string | null>(null); // null = not editing, show stored value
  const [picker, setPicker] = useState<"expirationDate" | "renewalDate" | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (fields: Editable) => {
    try {
      await updateDoc(doc(db, "users", uid, "docs", params.docId), { ...fields, needsReview: false, reviewedAt: serverTimestamp() });
    } catch (e: any) { Alert.alert("Couldn't save", e?.message ?? "Please try again."); }
  };

  const share = async () => {
    if (!d) return;
    try { await downloadAndShare(await getDownloadURL(ref(storage, d.storagePath)), d.title, d.contentType, d.storagePath); }
    catch (e: any) { Alert.alert("Couldn't share file", e?.message ?? "Please try again."); }
  };

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable onPress={share} hitSlop={10} disabled={!d}><Ionicons name="share-outline" size={24} color={colors.accent} /></Pressable>
      ),
    });
  }, [nav, d?.storagePath]);

  // Deleted (here or elsewhere) or never existed: leave the screen. This is the only place that navigates back
  // after a delete, so the snapshot update and the delete handler never both pop the screen.
  useEffect(() => { if (docs && !d && nav.canGoBack()) nav.goBack(); }, [docs, d, nav]);

  if (!d) return <View style={s.center}><ActivityIndicator /></View>;

  const cat = categoryFor(d.docType);
  const st = statusLine(d, today);
  const reminder = defaultReminder(d, today);
  const subtitle = subtitleFor(d.issuer, d.documentNumberLast4);
  const failed = d.status === "failed", processing = d.status === "processing";

  const rename = () =>
    Alert.prompt("Name", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Save", onPress: (v?: string) => v?.trim() && save({ title: v.trim() }) }], "plain-text", d.title ?? "");

  const pickCategory = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Cancel", ...CATEGORIES.map((c) => c.label)], cancelButtonIndex: 0, title: "Category" },
      (i) => { if (i > 0) save({ docType: CATEGORIES[i - 1].docType }); }
    );

  const retry = async () => { setBusy(true); try { await tryAgain(d.id); } finally { setBusy(false); } };

  const remove = () =>
    Alert.alert("Delete this document?", "This removes the file and its reminders.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        deleteObject(ref(storage, d.storagePath)).catch(() => {});
        await deleteDoc(doc(db, "users", uid, "docs", params.docId)); // the docs snapshot then pops this screen
      } },
    ]);

  // Local noon on the stored day, so the inline calendar highlights the right date regardless of timezone/DST.
  const pickerValue = picker && d[picker] && parseISODate(d[picker]) !== null
    ? new Date(+d[picker]!.slice(0, 4), +d[picker]!.slice(5, 7) - 1, +d[picker]!.slice(8, 10), 12) : null;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <FilePreview storagePath={d.storagePath} contentType={d.contentType} title={d.title} height={150} badge="Original scan" showLink={false} background={tint(cat.color, 0.18)} />

      <Pressable onPress={rename}><Text style={s.title}>{d.title || "Document"}</Text></Pressable>
      {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      <View style={[s.pill, { backgroundColor: tint(st.color) }]}>
        {processing || busy ? <ActivityIndicator size="small" color={st.color} /> : <View style={[s.dot, { backgroundColor: st.color }]} />}
        <Text style={[s.pillText, { color: st.color }]}>{st.text}</Text>
      </View>
      {failed && !busy && (
        <Pressable style={s.retry} onPress={retry}><Text style={s.retryText}>Try again</Text></Pressable>
      )}
      {failed && <Text style={s.failedHint}>We couldn't read this document. Try again, or fill in the details yourself.</Text>}

      <SectionHeader>Details</SectionHeader>
      <Card>
        <Row label="Category" value={cat.label} onPress={pickCategory} />
        <Separator />
        <View style={s.row}>
          <Text style={s.rowLabel}>Holder</Text>
          <TextInput
            style={s.rowInput}
            value={holder ?? d.holderName ?? ""}
            placeholder="Add"
            placeholderTextColor={colors.textTertiary}
            textAlign="right"
            onFocus={() => setHolder(d.holderName ?? "")}
            onChangeText={setHolder}
            onEndEditing={() => { const v = (holder ?? "").trim(); if (v !== (d.holderName ?? "")) save({ holderName: v || null }); setHolder(null); }}
            returnKeyType="done"
          />
        </View>
        <Separator />
        <Row label="Expires" value={d.expirationDate ? longDate(d.expirationDate) : "Add"} muted={!d.expirationDate} onPress={() => setPicker("expirationDate")} />
        <Separator />
        <Row label="Renewal" value={d.renewalDate ? longDate(d.renewalDate) : "None"} muted={!d.renewalDate} onPress={() => setPicker("renewalDate")} />
        <Separator />
        <Row label="Added" value={d.createdAt ? longDate(toISODate(new Date(d.createdAt.seconds * 1000))) : ""} />
      </Card>

      <SectionHeader>Reminder</SectionHeader>
      <Card>
        <View style={s.reminder}>
          <View style={s.bell}><Ionicons name="notifications" size={16} color={colors.danger} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.reminderTitle}>Default · 30 days before</Text>
            <Text style={s.reminderSub}>{reminder ? `${reminder.when} · ${reminder.state}` : "Add an expiry date to get reminded."}</Text>
          </View>
        </View>
      </Card>

      <Pressable onPress={remove} style={s.deleteWrap}><Text style={s.delete}>Delete Document</Text></Pressable>

      <DatePickerSheet
        visible={picker !== null}
        title={picker === "renewalDate" ? "Renewal" : "Expires"}
        value={pickerValue}
        onConfirm={(date) => { if (picker) save({ [picker]: toISODate(date) }); setPicker(null); }}
        onClear={picker && d[picker] ? () => { save({ [picker!]: null }); setPicker(null); } : undefined}
        onCancel={() => setPicker(null)}
      />
    </ScrollView>
  );
}

function Row({ label, value, muted, onPress }: { label: string; value: string; muted?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && onPress && { backgroundColor: "#F7F7F9" }]} onPress={onPress} disabled={!onPress}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, muted && { color: colors.textTertiary }, onPress && !muted && { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { ...type.title, color: colors.text, marginTop: 16 },
  subtitle: { ...type.subline, color: colors.textTertiary, marginTop: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: "600" },
  retry: { marginTop: 12, height: 44, borderRadius: radius.card, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  failedHint: { ...type.caption, color: colors.textSecondary, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, minHeight: 44, backgroundColor: colors.card },
  rowLabel: { ...type.body, color: colors.text },
  rowValue: { ...type.body, color: colors.textSecondary, flexShrink: 1 },
  rowInput: { ...type.body, color: colors.textSecondary, flex: 1, paddingVertical: 10 },
  reminder: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  bell: { width: 32, height: 32, borderRadius: 8, backgroundColor: tint(colors.danger), alignItems: "center", justifyContent: "center" },
  reminderTitle: { ...type.body, color: colors.text },
  reminderSub: { ...type.caption, color: colors.textTertiary, marginTop: 2 },
  deleteWrap: { marginTop: 32, alignItems: "center" },
  delete: { ...type.body, color: colors.danger },
});
