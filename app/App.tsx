import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import * as Notifications from "expo-notifications";
import { auth } from "./src/firebase";
import { registerForPush } from "./src/lib/notifications";
import SignInScreen from "./src/screens/SignInScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ReviewScreen from "./src/screens/ReviewScreen";
import type { RootStackParamList } from "./src/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (u) registerForPush(u.uid, u.email).catch(console.warn);
  }), []);

  // Tapping a notification opens that document's review screen.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const docId = r.notification.request.content.data?.docId as string | undefined;
      if (docId) navRef.current?.navigate("Review", { docId });
    });
    return () => sub.remove();
  }, []);

  if (user === undefined) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;

  return (
    <NavigationContainer ref={navRef}>
      <StatusBar style="dark" />
      {user ? (
        <Stack.Navigator>
          <Stack.Screen name="Home" options={{ headerShown: false }}>{() => <HomeScreen uid={user.uid} />}</Stack.Screen>
          <Stack.Screen name="Review" options={{ title: "", headerBackTitle: "Back" }}>{() => <ReviewScreen uid={user.uid} />}</Stack.Screen>
        </Stack.Navigator>
      ) : <SignInScreen />}
    </NavigationContainer>
  );
}
