import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { categoryFor } from "../lib/status";

// Colored rounded square with a white glyph, per SPEC "Category icons".
export default function CategoryIcon({ docType, size = 36 }: { docType?: string | null; size?: number }) {
  const c = categoryFor(docType);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.25, backgroundColor: c.color, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={c.icon as any} size={size * 0.55} color="#fff" />
    </View>
  );
}
