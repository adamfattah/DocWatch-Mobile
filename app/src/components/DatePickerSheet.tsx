import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

type Props = {
  visible: boolean;
  title: string;
  value: Date | null;
  onConfirm: (d: Date) => void;
  onClear?: () => void;
  onCancel: () => void;
};

// Native inline iOS calendar in a bottom sheet with Clear / Done.
export default function DatePickerSheet({ visible, title, value, onConfirm, onClear, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Date>(value ?? new Date());
  useEffect(() => { if (visible) setDraft(value ?? new Date()); }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.bar}>
          {onClear ? <Pressable onPress={onClear} hitSlop={10}><Text style={s.clear}>Clear</Text></Pressable> : <View style={{ width: 44 }} />}
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={() => onConfirm(draft)} hitSlop={10}><Text style={s.done}>Done</Text></Pressable>
        </View>
        <DateTimePicker
          value={draft}
          mode="date"
          display="inline"
          themeVariant="light"
          accentColor={colors.accent}
          onChange={(_, d) => d && setDraft(d)}
          style={{ alignSelf: "center" }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 12, paddingTop: 8 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 8 },
  title: { fontSize: 17, fontWeight: "600", color: colors.text },
  clear: { fontSize: 17, color: colors.danger },
  done: { fontSize: 17, fontWeight: "600", color: colors.accent },
});
