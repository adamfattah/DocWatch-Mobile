import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, type } from "../theme";

export default function LargeHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: React.ReactNode }) {
  return (
    <View style={s.wrap}>
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <Text style={s.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { ...type.eyebrow, marginBottom: 2 },
  title: { ...type.largeTitle, color: colors.text },
});
