import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import LargeHeader from "../components/LargeHeader";
import RoundButton from "../components/RoundButton";
import DocRow from "../components/DocRow";
import { Card, SectionHeader } from "../components/Card";
import { useDocs } from "../lib/docs";
import { useAddDocument } from "../lib/addDocument";
import { BUCKETS, Bucket, bucketFor, countBuckets, defaultBucket, eyebrowDate, governingDate, parseISODate, todayISO } from "../lib/status";
import { colors, radius, type } from "../theme";
import type { RootStackParamList } from "../types";

const EMPTY: Record<Bucket, string> = {
  expired: "Nothing has expired.",
  soon30: "Nothing expires within 30 days.",
  soon90: "Nothing expires within 90 days.",
  good: "No documents valid beyond 90 days.",
  none: "",
};

export default function UpcomingScreen({ uid }: { uid: string }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const docs = useDocs();
  const { add, uploading } = useAddDocument(uid);
  const [picked, setPicked] = useState<Bucket | null>(null);
  const now = new Date();
  const today = todayISO(now);

  const counts = useMemo(() => countBuckets(docs ?? [], today), [docs, today]);
  const selected = picked ?? defaultBucket(counts);
  const list = useMemo(() => (docs ?? [])
    .filter((d) => (d.status === "ready" || d.status === "no_date") && bucketFor(d, today) === selected)
    .sort((a, b) => (parseISODate(governingDate(a)?.iso) ?? 0) - (parseISODate(governingDate(b)?.iso) ?? 0)), [docs, selected, today]);
  const tile = BUCKETS.find((b) => b.key === selected)!;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.content}>
        <LargeHeader eyebrow={eyebrowDate(now)} title="Upcoming" right={<RoundButton icon="camera" onPress={add} busy={uploading} />} />

        <View style={s.grid}>
          {BUCKETS.map((b) => {
            const on = b.key === selected;
            return (
              <Pressable key={b.key} style={[s.tile, on && { backgroundColor: b.color }]} onPress={() => setPicked(b.key)}>
                <View style={s.tileTop}>
                  <View style={[s.tileIcon, { backgroundColor: on ? "rgba(255,255,255,0.28)" : b.color }]}>
                    <Ionicons name={b.icon as any} size={15} color="#fff" />
                  </View>
                  <Text style={[s.count, on && s.onWhite]}>{counts[b.key]}</Text>
                </View>
                <Text style={[s.tileLabel, on && s.onWhite, on && { fontWeight: "600" }]}>{b.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader>{tile.label}</SectionHeader>
        {docs === null ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : list.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.empty}>{docs.length === 0 ? "Nothing yet. Tap the camera to add your first document." : EMPTY[selected]}</Text>
          </Card>
        ) : (
          <Card>
            {list.map((d, i) => <DocRow key={d.id} doc={d} today={today} last={i === list.length - 1} onPress={() => nav.navigate("Document", { docId: d.id })} />)}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  tile: { width: "48%", flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.card, padding: 14, minHeight: 84 },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tileIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  count: { fontSize: 24, fontWeight: "700", color: colors.text },
  tileLabel: { ...type.subline, color: colors.textSecondary, marginTop: 10 },
  onWhite: { color: "#fff" },
  emptyCard: { padding: 24 },
  empty: { ...type.subline, color: colors.textTertiary, textAlign: "center", lineHeight: 22 },
});
