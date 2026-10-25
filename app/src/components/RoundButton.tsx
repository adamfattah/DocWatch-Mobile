import React from "react";
import { Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

// Blue circular icon button (camera on Upcoming, + on Documents).
export default function RoundButton({ icon, onPress, busy }: { icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]} onPress={onPress} disabled={busy} hitSlop={8}>
      {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={22} color="#fff" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 4 },
});
