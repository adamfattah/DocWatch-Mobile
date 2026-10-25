import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, NavigationContainerRef, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { onAuthStateChanged, User } from "firebase/auth";
import * as Notifications from "expo-notifications";
import { auth } from "./src/firebase";
import { saveProfile } from "./src/lib/notifications";
import { DocsProvider } from "./src/lib/docs";
import { SettingsProvider, useSettings } from "./src/lib/settings";
import { LockProvider, useLock } from "./src/lib/lock";
import LockScreen from "./src/components/LockScreen";
import NotificationPrimingScreen from "./src/screens/NotificationPrimingScreen";
import SignInScreen from "./src/screens/SignInScreen";
import UpcomingScreen from "./src/screens/UpcomingScreen";
import DocumentsScreen from "./src/screens/DocumentsScreen";
import SharedScreen from "./src/screens/SharedScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import DocumentDetailScreen from "./src/screens/DocumentDetailScreen";
import { colors } from "./src/theme";
import type { RootStackParamList, TabParamList } from "./src/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, [React.ComponentProps<typeof Ionicons>["name"], React.ComponentProps<typeof Ionicons>["name"]]> = {
  Upcoming: ["time-outline", "time"],
  Documents: ["document-text-outline", "document-text"],
  Shared: ["people-outline", "people"],
  Settings: ["settings-outline", "settings"],
};

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.accent, card: colors.card } };

function Tabs({ uid }: { uid: string }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.separator },
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={TAB_ICONS[route.name][focused ? 1 : 0]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Upcoming">{() => <UpcomingScreen uid={uid} />}</Tab.Screen>
      <Tab.Screen name="Documents">{() => <DocumentsScreen uid={uid} />}</Tab.Screen>
      <Tab.Screen name="Shared" component={SharedScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (u) saveProfile(u.uid, u.email).catch(console.warn);
  }), []);

  // Tapping a notification opens that document.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const docId = r.notification.request.content.data?.docId as string | undefined;
      if (docId) navRef.current?.navigate("Document", { docId });
    });
    return () => sub.remove();
  }, []);

  if (user === undefined) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator /></View>;

  // SafeAreaProvider at the root so screens rendered outside a navigator (sign-in, priming, lock) get real insets.
  return (
    <SafeAreaProvider>
    <NavigationContainer ref={navRef} theme={theme}>
      <StatusBar style="dark" />
      {user ? (
        <SettingsProvider uid={user.uid}>
          <DocsProvider uid={user.uid}>
            <LockProvider>
              <SignedIn uid={user.uid} />
            </LockProvider>
          </DocsProvider>
        </SettingsProvider>
      ) : <SignInScreen />}
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

// Priming once after first sign-in, then the app; the Face ID cover sits over everything while locked.
function SignedIn({ uid }: { uid: string }) {
  const { settings } = useSettings();
  const { locked, unlock, setEnabled } = useLock();
  // Keep the on-device lock flag in step with the account setting (new device, reinstall, or sign-out/in).
  useEffect(() => { if (settings) setEnabled(settings.requireFaceId === true); }, [settings?.requireFaceId, setEnabled]);
  return (
    <View style={{ flex: 1 }}>
      {settings === null ? (
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator /></View>
      ) : settings.notificationPrompted !== true ? (
        <NotificationPrimingScreen />
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Tabs" options={{ headerShown: false }}>{() => <Tabs uid={uid} />}</Stack.Screen>
          <Stack.Screen
            name="Document"
            options={{ title: "", headerBackTitle: "Back", headerTintColor: colors.accent, headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }}
          >
            {() => <DocumentDetailScreen uid={uid} />}
          </Stack.Screen>
        </Stack.Navigator>
      )}
      {locked && <LockScreen onUnlock={unlock} />}
    </View>
  );
}
