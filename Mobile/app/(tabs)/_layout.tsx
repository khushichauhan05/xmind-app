import React from "react";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";

import PillTabBar from "@/components/PillTabBar";

/**
 * Tab navigator. Five tabs in IA order:
 *   Home → Search → Create (raised, opens modal stack screen) → Reels → Profile.
 *
 * Auth gating happens here so the tab UI never paints for an
 * anonymous user — single redirect keeps entry feel instant.
 *
 * The `create` "tab" is virtual: it's a `Tabs.Screen` that points to the
 * `create` stack route at root level, so tapping it pushes a full-screen
 * create sheet instead of switching tabs. Notifications and Messages
 * (chat inbox) live as top-bar icons on Home and as their own stack
 * routes — moving them off the bottom bar matches the IG/FB pattern
 * the user explicitly asked for.
 */
export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)" />;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
      tabBar={(props) => <PillTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="reels" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
