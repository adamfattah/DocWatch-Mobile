import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CategoryIcon from "./CategoryIcon";
import { Separator } from "./Card";
import { statusLine, rowDate } from "../lib/status";
import { tryAgain } from "../lib/reprocess";
import { colors, type } from "../theme";
import type { Doc } from "../types";

// List row used by Upcoming and Documents: icon, title, colored status line, date, chevron.
export default function DocRow({ doc, today, onPress, last }: { doc: Doc; today: string; onPress: () => void; last?: boolean }) {
  const [retrying, setRetrying] = useState(false);
  const st = statusLine(doc, today);
  const processing = doc.status === "processing";
  const failed = doc.status === "failed";

  const retry = async () => { setRetrying(true); try { await tryAgain(doc.id); } finally { setRetrying(false); } };

  return (
    <>
      <Pressable style={({ pressed }) => [s.row, pressed && !processing && { backgroundColor: "#F7F7F9" }]} onPress={onPress} disabled={processing}>
        <CategoryIcon docType={doc.docType} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{doc.title || "Document"}</Text>
          <Text style={[s.status, { color: st.color }]} numberOfLines={1}>{st.text}</Text>
        </View>
        {processing || retrying ? (
          <ActivityIndicator />
        ) : failed ? (
          <Pressable onPress={retry} hitSlop={10}><Text style={s.tryAgain}>Try again</Text></Pressable>
        ) : (
          <>
            <Text style={s.date}>{rowDate(doc)}</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </>
        )}
      </Pressable>
      {!last && <Separator />}
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card },
  title: { ...type.rowTitle, color: colors.text },
  status: { ...type.subline, marginTop: 2 },
  date: { ...type.subline, color: colors.textTertiary },
  tryAgain: { ...type.subline, color: colors.accent, fontWeight: "600" },
});
