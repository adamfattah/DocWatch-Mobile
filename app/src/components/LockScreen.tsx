import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";

// Full-screen cover while Require Face ID is on and the app is locked.
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View style={s.wrap}>
      <View style={s.logo}><Ionicons name="document-text" size={36} color={colors.accent} /></View>
      <Text style={s.title}>DocWatch is locked</Text>
      <Text style={s.sub}>Use Face ID or your passcode to continue.</Text>
      <Pressable style={s.btn} onPress={onUnlock}><Ionicons name="scan" size={18} color="#fff" /><Text style={s.btnText}>Unlock</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32, zIndex: 1000 },
  logo: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 20 },
  sub: { fontSize: 15, color: colors.textSecondary, marginTop: 6, textAlign: "center" },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 28, height: 48, paddingHorizontal: 24, borderRadius: radius.card, backgroundColor: colors.accent },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
