import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { isImage } from "../lib/files";
import FileViewer from "./FileViewer";

type Props = { storagePath: string; contentType: string; title?: string; height?: number; badge?: string; showLink?: boolean; background?: string };

// 220pt preview box on the Review screen. Images render directly; PDFs (and anything else)
// render through a non-interactive WebView showing the first page. Tap, or "View file", opens the viewer.
export default function FilePreview({ storagePath, contentType, title, height = 220, badge, showLink = true, background = "#f2f2f2" }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    setFailed(false); setRendered(false); setUrl(null);
    getDownloadURL(ref(storage, storagePath)).then(setUrl).catch(() => setFailed(true));
  }, [storagePath]);

  useEffect(load, [load, attempt]);

  const retry = () => setAttempt((a) => a + 1);
  const fail = () => { setRendered(true); setFailed(true); };
  const image = isImage(contentType);

  return (
    <View>
      <Pressable style={[s.box, { height, backgroundColor: background }]} onPress={() => url && !failed && setOpen(true)} disabled={!url || failed}>
        {failed ? (
          <View style={s.center}>
            <Text style={s.error}>Couldn't load file</Text>
            <Pressable onPress={retry} hitSlop={8}><Text style={s.retry}>Retry</Text></Pressable>
          </View>
        ) : url ? (
          image ? (
            <Image key={attempt} source={{ uri: url }} style={s.fill} resizeMode="contain" onLoadEnd={() => setRendered(true)} onError={fail} />
          ) : (
            <View style={s.fill} pointerEvents="none">
              <WebView
                key={attempt}
                source={{ uri: url }}
                style={s.fill}
                originWhitelist={["*"]}
                scrollEnabled={false}
                bounces={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                onLoadEnd={() => setRendered(true)}
                onError={fail}
                onHttpError={fail}
              />
            </View>
          )
        ) : null}
        {!failed && !rendered && <View style={[s.center, s.overlay]} pointerEvents="none"><ActivityIndicator /></View>}
        {!!badge && <View style={s.badge} pointerEvents="none"><Text style={s.badgeText}>{badge}</Text></View>}
      </Pressable>
      {showLink && url && !failed && (
        <Pressable onPress={() => setOpen(true)} hitSlop={8} style={s.linkWrap}>
          <Text style={s.link}>View file</Text>
        </Pressable>
      )}
      {url && (
        <FileViewer visible={open} url={url} title={title} contentType={contentType} storagePath={storagePath} onClose={() => setOpen(false)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: "100%", borderRadius: 12, overflow: "hidden" },
  badge: { position: "absolute", left: 10, bottom: 10, backgroundColor: "rgba(60,60,67,0.75)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  fill: { flex: 1, width: "100%", height: "100%", backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  error: { color: "#666", fontSize: 15 },
  retry: { color: "#111", fontSize: 15, fontWeight: "600", textDecorationLine: "underline" },
  linkWrap: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 8 },
  link: { color: "#111", fontSize: 14, textDecorationLine: "underline" },
});
