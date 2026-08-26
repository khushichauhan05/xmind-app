import "../global.css";

import React, { useState } from "react";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";

/**
 * Inner stack — needs `useTheme()` so it sits under the providers.
 * Splitting it keeps StatusBar style perfectly synced with the active
 * colour scheme on every render.
 *
 * IA shifts:
 *  - Notifications and Messages move OFF the bottom tab bar.
 *  - Notifications opens as a stack screen from the home top bar.
 *  - Messages inbox + thread are stack screens from the home top bar.
 *  - Create is also a stack screen, presented as a fullscreen modal from
 *    the centred tab-bar plus button.
 */
function ThemedStack() {
  const { statusBarStyle, colors } = useTheme();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.canvas },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user-profile" />
        <Stack.Screen name="hashtag-posts" />
        <Stack.Screen name="notifications" />
        <Stack.Screen
          name="create"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/[conversationId]" />
      </Stack>
      <StatusBar style={statusBarStyle} animated />
    </>
  );
}

/**
 * Root provider stack. Order matters:
 *   GestureHandlerRoot → KeyboardProvider → SafeAreaProvider → Clerk
 *   → ReactQuery → app.
 *
 * KeyboardProvider must wrap the navigators because chat composers use
 * `react-native-keyboard-controller`'s primitives (KeyboardStickyView,
 * KeyboardAvoidingView). The package's docs are explicit on this.
 */
export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ClerkProvider tokenCache={tokenCache}>
            <QueryClientProvider client={queryClient}>
              <ThemedStack />
            </QueryClientProvider>
          </ClerkProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
