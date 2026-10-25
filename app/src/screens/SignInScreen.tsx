import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { signInWithApple, signInWithGoogle, signInWithEmail, resetPassword } from "../lib/auth";
import { colors, radius, tint, type } from "../theme";

const VALUES: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; body: string }[] = [
  { icon: "scan-outline", title: "Scan or import", body: "Take a photo or import a PDF." },
  { icon: "sparkles-outline", title: "Dates found for you", body: "AI identifies the document and reads its expiry and renewal dates." },
  { icon: "notifications-outline", title: "Reminded in time", body: "30 days ahead by default, or on a date you choose." },
];

export default function SignInScreen() {
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED" && e?.code !== "-5") Alert.alert("Couldn't sign in", e?.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.logo}><Ionicons name="document-text" size={40} color={colors.accent} /></View>
          <Text style={s.title}>DocWatch</Text>
          <Text style={s.tag}>Keep every important document current, with a reminder before anything expires.</Text>

          <View style={s.values}>
            {VALUES.map((v) => (
              <View key={v.title} style={s.value}>
                <View style={s.valueIcon}><Ionicons name={v.icon} size={20} color={colors.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.valueTitle}>{v.title}</Text>
                  <Text style={s.valueBody}>{v.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.buttons}>
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={radius.card} style={s.apple} onPress={() => run(signInWithApple)} />
            )}
            <Pressable style={[s.google, busy && s.dim]} disabled={busy} onPress={() => run(signInWithGoogle)}>
              <Text style={s.g}>G</Text><Text style={s.googleText}>Continue with Google</Text>
            </Pressable>

            {!emailMode ? (
              <Pressable onPress={() => setEmailMode(true)} hitSlop={8}><Text style={s.link}>Continue with Email</Text></Pressable>
            ) : (
              <View style={s.emailForm}>
                <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address"
                  autoComplete="email" value={email} onChangeText={setEmail} autoFocus />
                <TextInput style={s.input} placeholder="Password" placeholderTextColor={colors.textTertiary} secureTextEntry autoComplete="password"
                  value={password} onChangeText={setPassword} />
                <Pressable style={[s.primary, (busy || !email || password.length < 6) && s.dim]} disabled={busy || !email || password.length < 6}
                  onPress={() => run(() => signInWithEmail(email.trim(), password))}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Continue with Email</Text>}
                </Pressable>
                <Pressable hitSlop={8} onPress={() => email ? run(() => resetPassword(email.trim()).then(() => Alert.alert("Sent", "Check your email."))) : Alert.alert("Enter your email first")}>
                  <Text style={s.forgot}>Forgot password?</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={s.footer}>By continuing you agree to the Terms and Privacy Policy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 16, alignItems: "center" },
  logo: { width: 76, height: 76, borderRadius: 18, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  title: { fontSize: 30, fontWeight: "700", color: colors.text, marginTop: 18 },
  tag: { ...type.subline, color: colors.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 21, paddingHorizontal: 12 },
  values: { alignSelf: "stretch", marginTop: 28, gap: 18 },
  value: { flexDirection: "row", alignItems: "center", gap: 14 },
  valueIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: tint(colors.accent, 0.12), alignItems: "center", justifyContent: "center" },
  valueTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  valueBody: { fontSize: 13, color: colors.textSecondary, marginTop: 1, lineHeight: 18 },
  buttons: { alignSelf: "stretch", marginTop: "auto", paddingTop: 28, gap: 12, alignItems: "center" },
  apple: { height: 50, alignSelf: "stretch" },
  google: { alignSelf: "stretch", height: 50, borderRadius: radius.card, borderWidth: 1, borderColor: "#D1D1D6", backgroundColor: colors.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  g: { fontSize: 18, fontWeight: "800", color: colors.accent },
  googleText: { fontSize: 17, fontWeight: "600", color: colors.text },
  link: { ...type.body, color: colors.accent, marginTop: 4 },
  emailForm: { alignSelf: "stretch", gap: 10 },
  input: { height: 48, borderRadius: radius.card, backgroundColor: colors.card, borderWidth: 1, borderColor: "#E5E5EA", paddingHorizontal: 14, fontSize: 16, color: colors.text },
  primary: { height: 50, borderRadius: radius.card, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  forgot: { textAlign: "center", color: colors.textSecondary, marginTop: 2 },
  dim: { opacity: 0.5 },
  footer: { ...type.caption, color: colors.textTertiary, textAlign: "center", marginTop: 18 },
});
