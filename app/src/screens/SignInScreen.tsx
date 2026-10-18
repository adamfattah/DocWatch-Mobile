import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { signInWithApple, signInWithGoogle, signInWithEmail, resetPassword } from "../lib/auth";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") Alert.alert("Couldn't sign in", e?.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.logo}>docwatch</Text>
      <Text style={s.tag}>Snap a document. We'll remind you before it expires.</Text>

      {Platform.OS === "ios" && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12} style={s.apple} onPress={() => run(signInWithApple)} />
      )}
      <Pressable style={s.google} disabled={busy} onPress={() => run(signInWithGoogle)}>
        <Text style={s.googleText}>Continue with Google</Text>
      </Pressable>

      <Text style={s.or}>or</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address"
        autoComplete="email" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry autoComplete="password"
        value={password} onChangeText={setPassword} />
      <Pressable style={[s.primary, busy && s.dim]} disabled={busy || !email || password.length < 6}
        onPress={() => run(() => signInWithEmail(email.trim(), password))}>
        <Text style={s.primaryText}>Continue with Email</Text>
      </Pressable>
      <Pressable onPress={() => email ? run(() => resetPassword(email.trim()).then(() => Alert.alert("Sent", "Check your email."))) : Alert.alert("Enter your email first")}>
        <Text style={s.link}>Forgot password?</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  logo: { fontSize: 40, fontWeight: "800", textAlign: "center", letterSpacing: -1 },
  tag: { textAlign: "center", color: "#666", marginBottom: 24, fontSize: 16 },
  apple: { height: 50, width: "100%" },
  google: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center" },
  googleText: { fontSize: 17, fontWeight: "600" },
  or: { textAlign: "center", color: "#999", marginVertical: 4 },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: "#ddd", paddingHorizontal: 14, fontSize: 16 },
  primary: { height: 50, borderRadius: 12, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  dim: { opacity: 0.5 },
  link: { textAlign: "center", color: "#666", marginTop: 8 },
});
