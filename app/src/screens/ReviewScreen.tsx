import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";
import type { Doc, RootStackParamList } from "../types";
import FilePreview from "../components/FilePreview";

// Optional review. User can confirm with one tap, fix the date, or ignore the screen entirely.
export default function ReviewScreen({ uid }: { uid: string }) {
  const { params } = useRoute<RouteProp<RootStackParamList, "Review">>();
  const nav = useNavigation();
  const [d, setD] = useState<Doc | null>(null);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    const r = doc(db, "users", uid, "docs", params.docId);
    return onSnapshot(r, (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...(snap.data() as Omit<Doc, "id">) };
      setD(data);
      setDate((prev) => prev || data.expirationDate || data.renewalDate || "");
      setTitle((prev) => prev || data.title || "");
    });
  }, [uid, params.docId]);

  const save = async () => {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert("Use YYYY-MM-DD");
    await updateDoc(doc(db, "users", uid, "docs", params.docId), {
      expirationDate: date || null, title: title || "Document", needsReview: false, reviewedAt: serverTimestamp(),
    });
    nav.goBack();
  };

  const remove = () =>
    Alert.alert("Delete this document?", undefined, [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (d) deleteObject(ref(storage, d.storagePath)).catch(() => {});
        await deleteDoc(doc(db, "users", uid, "docs", params.docId));
        nav.goBack();
      } },
    ]);

  if (!d) return null;
  return (
    <View style={s.wrap}>
      <FilePreview storagePath={d.storagePath} contentType={d.contentType} title={d.title} />
      {d.needsReview && <Text style={s.hint}>We weren't sure about this one. Does this look right?</Text>}
      <Text style={s.label}>Name</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} />
      <Text style={s.label}>Expires (YYYY-MM-DD)</Text>
      <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="2028-05-31" keyboardType="numbers-and-punctuation" />
      {d.confidence !== undefined && <Text style={s.meta}>AI confidence {Math.round(d.confidence * 100)}%{d.issuer ? ` - ${d.issuer}` : ""}</Text>}
      <Pressable style={s.primary} onPress={save}><Text style={s.primaryText}>Looks right</Text></Pressable>
      <Pressable onPress={remove}><Text style={s.delete}>Delete</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff", padding: 20, gap: 8 },
  hint: { backgroundColor: "#fff3cd", color: "#7a5a00", padding: 12, borderRadius: 10, marginBottom: 8 },
  label: { color: "#666", fontSize: 13, marginTop: 8 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#ddd", paddingHorizontal: 14, fontSize: 16 },
  meta: { color: "#999", fontSize: 13, marginTop: 4 },
  primary: { height: 52, borderRadius: 12, backgroundColor: "#111", alignItems: "center", justifyContent: "center", marginTop: 16 },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  delete: { textAlign: "center", color: "#c0392b", marginTop: 16 },
});
