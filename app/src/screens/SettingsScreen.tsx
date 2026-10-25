import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LargeHeader from "../components/LargeHeader";
import { Card } from "../components/Card";
import { signOut } from "../lib/auth";
import { colors, type } from "../theme";

// Placeholder: only Sign Out for now; reminders, privacy and profile arrive in a later step.
export default function SettingsScreen() {
  const confirm = () => Alert.alert("Sign out?", undefined, [{ text: "Cancel" }, { text: "Sign Out", style: "destructive", onPress: signOut }]);
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <LargeHeader title="Settings" />
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <Card>
          <Pressable style={s.row} onPress={confirm}><Text style={s.signOut}>Sign Out</Text></Pressable>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  row: { height: 48, alignItems: "center", justifyContent: "center" },
  signOut: { ...type.body, color: colors.danger },
});
