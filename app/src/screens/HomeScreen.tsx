import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActionSheetIOS, Alert, ActivityIndicator } from "react-native";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { db } from "../firebase";
import { pickFromCamera, pickFromLibrary, pickFile, uploadDocument } from "../lib/upload";
import { signOut } from "../lib/auth";
import type { Doc, RootStackParamList } from "../types";

function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

function subtitle(d: Doc) {
  if (d.status === "processing") return "Reading...";
  if (d.status === "failed") return "Couldn't read this one. Try a clearer photo.";
  const target = d.expirationDate ?? d.renewalDate;
  if (!target) return "No expiration date found";
  const n = daysUntil(target)!;
  if (n < 0) return `Expired ${-n} day${n === -1 ? "" : "s"} ago`;
  if (n === 0) return "Expires today";
  if (n === 1) return "Expires tomorrow";
  return `Expires in ${n} days - ${target}`;
}

function tone(d: Doc) {
  const n = daysUntil(d.expirationDate ?? d.renewalDate);
  if (n === null) return "#888";
  if (n < 0) return "#c0392b";
  if (n <= 7) return "#d35400";
  if (n <= 30) return "#b7950b";
  return "#2e7d32";
}

export default function HomeScreen({ uid }: { uid: string }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users", uid, "docs"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Doc, "id">) }));
      // Soonest-expiring first; processing items pinned to top.
      list.sort((a, b) => {
        if (a.status === "processing") return -1;
        if (b.status === "processing") return 1;
        return (daysUntil(a.expirationDate ?? a.renewalDate) ?? 9e9) - (daysUntil(b.expirationDate ?? b.renewalDate) ?? 9e9);
      });
      setDocs(list);
    });
  }, [uid]);

  const add = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Cancel", "Take Photo", "Choose Photo", "Choose File"], cancelButtonIndex: 0 },
      async (i) => {
        const picker = [null, pickFromCamera, pickFromLibrary, pickFile][i];
        if (!picker) return;
        try {
          const picked = await picker();
          if (!picked) return;
          setUploading(true);
          await uploadDocument(uid, picked);
        } catch (e: any) {
          Alert.alert("Upload failed", e?.message ?? String(e));
        } finally { setUploading(false); }
      }
    );
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.title}>docwatch</Text>
        <Pressable onPress={() => Alert.alert("Sign out?", undefined, [{ text: "Cancel" }, { text: "Sign out", style: "destructive", onPress: signOut }])}>
          <Text style={s.signout}>Sign out</Text>
        </Pressable>
      </View>

      {docs === null ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={<Text style={s.empty}>Nothing yet.{"\n"}Snap a passport, license, policy, lease... anything that expires.</Text>}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => item.status !== "processing" && nav.navigate("Review", { docId: item.id })}>
              <View style={[s.dot, { backgroundColor: tone(item) }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{item.title ?? "Document"}</Text>
                <Text style={s.rowSub}>{subtitle(item)}</Text>
              </View>
              {item.needsReview && item.status !== "processing" && <Text style={s.badge}>Check</Text>}
              {item.status === "processing" && <ActivityIndicator />}
            </Pressable>
          )}
        />
      )}

      <Pressable style={[s.fab, uploading && s.dim]} disabled={uploading} onPress={add}>
        <Text style={s.fabText}>{uploading ? "Uploading..." : "+ Add document"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff", paddingTop: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  signout: { color: "#888" },
  empty: { textAlign: "center", color: "#888", marginTop: 80, paddingHorizontal: 40, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#e5e5e5" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  rowSub: { color: "#666", marginTop: 2 },
  badge: { backgroundColor: "#fff3cd", color: "#7a5a00", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, fontWeight: "600", overflow: "hidden" },
  fab: { position: "absolute", bottom: 40, left: 20, right: 20, height: 60, borderRadius: 16, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  fabText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  dim: { opacity: 0.5 },
});
