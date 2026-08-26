import React, { useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { storyRingGradient } from "@/constants/tokens";

/**
 * Welcome screen.
 *
 * Lever: PAS (Problem, Agitate, Solution) + Hick's Law (single CTA).
 *  Problem: feeds are noisy and forgettable. Agitate: implicit — every
 *  other social app already does this. Solution: a fast, clean place to
 *  share what's actually happening.
 *
 * Motion strategy:
 *  - The hero illustration breathes on a slow vertical loop and a
 *    second decorative layer counter-rotates very slightly to imply
 *    parallax depth without ever crossing into the kind of motion
 *    that triggers reduced-motion settings or vestibular discomfort.
 *  - Title + body fade and rise once on mount. Single, intentional
 *    cue — never a "look at me" entrance.
 *  - Primary CTA wears the same peach → coral → magenta sweep used on
 *    the tab bar's Create button and the Story rings, so the brand
 *    signature carries through from the very first surface a user sees.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, radii } = useTheme();

  const float = useSharedValue(0);
  const drift = useSharedValue(0);
  const fade = useSharedValue(0);
  const rise = useSharedValue(24);
  const ctaScale = useSharedValue(1);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    // Slower counter-loop on the back layer for the parallax effect.
    drift.value = withRepeat(
      withTiming(1, { duration: 4800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    fade.value = withDelay(120, withTiming(1, { duration: 480 }));
    rise.value = withDelay(120, withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 }));
  }, [drift, fade, float, rise]);

  // Foreground hero — moves more.
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -float.value * 10 },
      { translateX: float.value * 4 },
    ],
  }));

  // Background glow halo — moves less, opposite direction. The two
  // layers together produce a parallax depth cue without any 3D math.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.32 + drift.value * 0.16,
    transform: [
      { translateY: drift.value * 6 },
      { translateX: -drift.value * 3 },
      { scale: 1 + drift.value * 0.04 },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const onPressIn = useCallback(() => {
    ctaScale.value = withSpring(0.96, { damping: 16, stiffness: 360, mass: 0.5 });
  }, [ctaScale]);
  const onPressOut = useCallback(() => {
    ctaScale.value = withSpring(1, { damping: 16, stiffness: 360, mass: 0.5 });
  }, [ctaScale]);

  const onContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push("/(auth)/sign-in");
  }, [router]);

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-xl">
          <View
            style={{
              width: 320,
              height: 280,
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Halo backdrop — gradient sweep behind the hero so the
                first thing the user sees carries the brand signature. */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  width: 300,
                  height: 300,
                  borderRadius: 150,
                  overflow: "hidden",
                },
                haloStyle,
              ]}
            >
              <LinearGradient
                colors={storyRingGradient as unknown as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            </Animated.View>

            <Animated.View style={heroStyle}>
              <ExpoImage
                source={require("../../assets/images/auth2.png")}
                style={{ width: 280, height: 220 }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
              />
            </Animated.View>
          </View>

          <Animated.View
            style={contentStyle}
            className="items-center mt-xxl"
          >
            <Text
              variant="display"
              tone="primary"
              align="center"
              className="mb-md"
            >
              xMind
            </Text>
            <Text variant="title" tone="secondary" align="center" weight="500">
              Share what's happening. Right now.
            </Text>
            <Text
              variant="body"
              tone="tertiary"
              align="center"
              className="mt-base"
              style={{ maxWidth: 320 }}
            >
              Post in a tap. Follow people who get it. Catch the conversation while it's still hot.
            </Text>
          </Animated.View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm }}>
          <Animated.View style={ctaStyle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started"
              onPress={onContinue}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={{
                height: 54,
                borderRadius: radii.pill,
                overflow: "hidden",
                shadowColor: colors.tint.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.32,
                shadowRadius: 16,
                elevation: 10,
              }}
            >
              <LinearGradient
                colors={storyRingGradient as unknown as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <Text variant="subtitle" tone="inverse" weight="700">
                  Get started
                </Text>
                <Feather name="arrow-right" size={20} color={colors.text.onTint} />
              </LinearGradient>
            </Pressable>
          </Animated.View>
          <Text variant="caption" tone="tertiary" align="center">
            Tap continue and you're agreeing to our Terms and Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
