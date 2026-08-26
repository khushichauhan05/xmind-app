import React, { useCallback } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { useSocialAuth } from "@/hooks/useSocialAuth";
import { storyRingGradient } from "@/constants/tokens";

/**
 * Sign-in screen.
 *
 * Lever: FAB framework + decision-fatigue reduction.
 *  Feature: continue with Apple / Google. Advantage: one tap, no
 *  password to remember. Benefit: less friction in, less data shared.
 *
 * Design:
 *  - Two equally-weighted CTAs because both options are first-class
 *    auth providers; we don't lie about preference (no fake "recommended"
 *    badge — that's a dark pattern under the 2026 ethics rubric).
 *  - Visible "Continue with" divider clarifies that these are sign-in
 *    options, not third-party share buttons (a small but real source
 *    of confusion for first-time users).
 *  - Logo block carries the same coral-sunset gradient as the welcome
 *    hero halo and the tab-bar Create button, so the brand signature
 *    chains across every onboarding surface.
 */
export default function SignInScreen() {
  const { colors, spacing, radii } = useTheme();
  const { handleSocialAuth, isLoading } = useSocialAuth();

  const press = useCallback(
    (provider: "oauth_apple" | "oauth_google") => {
      Haptics.selectionAsync().catch(() => undefined);
      handleSocialAuth(provider);
    },
    [handleSocialAuth]
  );

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-1 px-xl">
          <View className="flex-1 items-center justify-center">
            <View
              style={{
                width: 104,
                height: 104,
                borderRadius: radii.xxl,
                overflow: "hidden",
                marginBottom: spacing.xl,
                shadowColor: colors.tint.primary,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.32,
                shadowRadius: 18,
                elevation: 10,
              }}
            >
              <LinearGradient
                colors={storyRingGradient as unknown as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ExpoImage
                  source={require("../../assets/images/xMind-Logo1.png")}
                  style={{ width: 60, height: 60, tintColor: colors.text.onTint }}
                  contentFit="contain"
                />
              </LinearGradient>
            </View>

            <Text variant="headline" tone="primary" align="center">
              Sign in to xMind
            </Text>
            <Text
              variant="body"
              tone="secondary"
              align="center"
              className="mt-sm"
              style={{ maxWidth: 320 }}
            >
              One tap. No passwords. We only keep what we need.
            </Text>
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            {/* Section divider so the buttons read as auth providers,
                not generic share buttons. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginBottom: spacing.md,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border.subtle }} />
              <Text variant="caption" tone="tertiary" weight="600">
                Continue with
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border.subtle }} />
            </View>

            <View style={{ gap: spacing.md }}>
              <ProviderButton
                label="Continue with Apple"
                icon={require("../../assets/images/apple.png")}
                loading={isLoading}
                onPress={() => press("oauth_apple")}
              />
              <ProviderButton
                label="Continue with Google"
                icon={require("../../assets/images/google.png")}
                loading={isLoading}
                onPress={() => press("oauth_google")}
              />
            </View>
          </View>

          <Text
            variant="caption"
            tone="tertiary"
            align="center"
            className="mb-lg"
          >
            By continuing you agree to our Terms and Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

interface ProviderButtonProps {
  label: string;
  icon: number;
  loading: boolean;
  onPress: () => void;
}

function ProviderButton({ label, icon, loading, onPress }: ProviderButtonProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        opacity: loading ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <Surface
        variant="solid"
        radius={radii.pill}
        style={{
          height: 56,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
          borderWidth: 1,
          borderColor: colors.border.subtle,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.tint.primary} />
        ) : (
          <>
            <ExpoImage
              source={icon}
              style={{ width: 22, height: 22 }}
              contentFit="contain"
            />
            <Text variant="subtitle" tone="primary">
              {label}
            </Text>
          </>
        )}
      </Surface>
    </Pressable>
  );
}
