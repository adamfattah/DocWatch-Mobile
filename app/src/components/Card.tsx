import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, type } from "../theme";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionHeader({ children }: { children: string }) {
  return <Text style={s.header}>{children.toUpperCase()}</Text>;
}

export const Separator = () => <View style={s.sep} />;

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: "hidden" },
  header: { ...type.sectionHeader, marginLeft: 16, marginBottom: 8, marginTop: 20 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 16 },
});
