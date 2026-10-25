import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet, ActivityIndicator } from "react-native";
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
import { CATEGORIES, CategoryKey, categoryFor, governingDate, parseISODate, todayISO } from "../lib/status";
import { colors, radius, type } from "../theme";
import type { Doc, RootStackParamList } from "../types";

export default function DocumentsScreen({ uid }: { uid: string }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const docs = useDocs();
  const { add, uploading } = useAddDocument(uid);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<CategoryKey | "all">("all");
  const today = todayISO();

  const present = useMemo(() => {
    const keys = new Set((docs ?? []).map((d) => categoryFor(d.docType).key));
    return CATEGORIES.filter((c) => keys.has(c.key));
  }, [docs]);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (d: Doc) => !q || (d.title ?? "").toLowerCase().includes(q) || (d.issuer ?? "").toLowerCase().includes(q);
    const byDate = (a: Doc, b: Doc) => (parseISODate(governingDate(a)?.iso) ?? 9e15) - (parseISODate(governingDate(b)?.iso) ?? 9e15);
    return CATEGORIES
      .filter((c) => cat === "all" || c.key === cat)
      .map((c) => ({ category: c, docs: (docs ?? []).filter((d) => categoryFor(d.docType).key === c.key && match(d)).sort(byDate) }))
      .filter((sct) => sct.docs.length > 0);
  }, [docs, search, cat]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <LargeHeader title="Documents" right={<RoundButton icon="add" onPress={add} busy={uploading} />} />

        <View style={s.search}>
          <Ionicons name="search" size={17} color={colors.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsWrap}>
          <Chip label="All" on={cat === "all"} onPress={() => setCat("all")} />
          {present.map((c) => <Chip key={c.key} label={c.label} on={cat === c.key} onPress={() => setCat(c.key)} />)}
        </ScrollView>

        {docs === null ? (
          <ActivityIndicator style={{ marginTop: 32 }} />
        ) : sections.length === 0 ? (
          <Text style={s.empty}>{docs.length === 0 ? "Nothing yet.\nTap + to add a passport, license, policy, lease... anything that expires." : "No documents match."}</Text>
        ) : sections.map((sct) => (
          <View key={sct.category.key}>
            <SectionHeader>{sct.category.label}</SectionHeader>
            <Card>
              {sct.docs.map((d, i) => <DocRow key={d.id} doc={d} today={today} last={i === sct.docs.length - 1} onPress={() => nav.navigate("Document", { docId: d.id })} />)}
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, on && s.chipOn]} onPress={onPress}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  search: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, borderRadius: 10, backgroundColor: colors.searchField, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 0 },
  chipsWrap: { marginHorizontal: -16, marginTop: 12 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: radius.chip, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: colors.accent },
  chipText: { ...type.subline, fontWeight: "600", color: colors.text },
  chipTextOn: { color: "#fff" },
  empty: { ...type.subline, color: colors.textTertiary, textAlign: "center", marginTop: 64, lineHeight: 22, paddingHorizontal: 24 },
});
