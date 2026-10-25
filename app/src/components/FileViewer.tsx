import React, { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator, Alert, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { downloadAndShare, isImage } from "../lib/files";

type Props = {
  visible: boolean;
  url: string;
  title?: string;
  contentType: string;
  storagePath: string;
  onClose: () => void;
};

// Full-screen viewer: pinch-to-zoom for images, native scrolling all-pages view for PDFs.
export default function FileViewer({ visible, url, title, contentType, storagePath, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = () => { setFailed(false); setLoading(true); setAttempt((a) => a + 1); };

  const share = async () => {
    setSharing(true);
    try { await downloadAndShare(url, title, contentType, storagePath); }
    catch (e: any) { Alert.alert("Couldn't share file", e?.message ?? "Please try again."); }
    finally { setSharing(false); }
  };

  const image = isImage(contentType);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[s.wrap, { paddingTop: insets.top }]}>
        <View style={s.bar}>
          <Pressable onPress={onClose} hitSlop={12}><Text style={s.barText}>Close</Text></Pressable>
          <Text style={s.barTitle} numberOfLines={1}>{title || "Document"}</Text>
          <Pressable onPress={share} hitSlop={12} disabled={sharing || failed}>
            {sharing ? <ActivityIndicator /> : <Text style={[s.barText, failed && s.disabled]}>Share</Text>}
          </Pressable>
        </View>

        <View style={s.body}>
          {failed ? (
            <View style={s.center}>
              <Text style={s.error}>Couldn't load file</Text>
              <Pressable style={s.retry} onPress={retry}><Text style={s.retryText}>Retry</Text></Pressable>
            </View>
          ) : image ? (
            <ScrollView
              key={attempt}
              style={s.fill}
              contentContainerStyle={{ width, height: height - insets.top - 52 - insets.bottom }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: url }}
                style={s.fill}
                resizeMode="contain"
                onLoadEnd={() => setLoading(false)}
                onError={() => { setLoading(false); setFailed(true); }}
              />
            </ScrollView>
          ) : (
            <WebView
              key={attempt}
              source={{ uri: url }}
              style={s.fill}
              originWhitelist={["*"]}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setLoading(false); setFailed(true); }}
              onHttpError={() => { setLoading(false); setFailed(true); }}
            />
          )}
          {loading && !failed && (
            <View style={[s.center, s.overlay]} pointerEvents="none"><ActivityIndicator size="large" /></View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff" },
  bar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  barText: { fontSize: 17, color: "#111" },
  disabled: { color: "#bbb" },
  barTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: "#111", marginHorizontal: 12 },
  body: { flex: 1, backgroundColor: "#f2f2f2" },
  fill: { flex: 1, width: "100%", height: "100%", backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  error: { color: "#666", fontSize: 16 },
  retry: { height: 44, paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
