import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LargeHeader from "../components/LargeHeader";
import { colors } from "../theme";

// Placeholder: sharing arrives in a later step.
export default function SharedScreen() {
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <LargeHeader title="Shared" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background } });
