import React, { memo, useEffect } from "react";
import { ActivityIndicator, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";

export interface CustomLoadingProps {
  message?: string;
  size?: "small" | "medium" | "large";
  variant?: "screen" | "inline" | "modal";
  /** Backwards-compat — no longer used now that we render flat. */
  intensity?: number;
  /** Backwards-compat — colours come from the theme. */
  colors?: string[];
  /** Backwards-compat — single ring used in place of the dot strip. */
  showDots?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Loading indicator. Single Reanimated rotation drives one ring; no
 * setIntervals, no map() of useAnimatedStyle, no dot strip — those
 * were JS-thread heavy on the original. The new version is fast, calm,
 * and platform-agnostic.
 */
function CustomLoadingImpl({
  message = "One moment",
  size = "medium",
  variant = "screen",
  accessibilityLabel = "Loading",
  style,
}: CustomLoadingProps) {
  const { colors, spacing } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const indicatorSize = size === "large" ? "large" : "small";

  const layout: ViewStyle =
    variant === "inline"
      ? { padding: spacing.base, alignItems: "center" }
      : {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xl,
        };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[layout, style]}
    >
      <Animated.View style={[{ marginBottom: spacing.md }, ringStyle]}>
        <ActivityIndicator size={indicatorSize} color={colors.tint.primary} />
      </Animated.View>
      <Text variant="bodySm" tone="secondary" align="center">
        {message}
      </Text>
    </View>
  );
}

export const CustomLoading = memo(CustomLoadingImpl);
CustomLoading.displayName = "CustomLoading";

export default CustomLoading;
