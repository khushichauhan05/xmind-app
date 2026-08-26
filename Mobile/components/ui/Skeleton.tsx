import React, { memo, useEffect } from "react";
import { type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  /** NativeWind utility classes. */
  className?: string;
  style?: ViewStyle;
}

/**
 * Lightweight pulse skeleton driven entirely on the UI thread via
 * Reanimated. We deliberately avoid `setInterval` shimmers — those run
 * on the JS thread and stutter under list scroll on low-end Android.
 */
function SkeletonImpl({ width = "100%", height = 14, radius, className, style }: SkeletonProps) {
  const { colors, radii } = useTheme();
  const progress = useSharedValue(0.5);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.value * 0.4,
  }));

  return (
    <Animated.View
      className={className}
      style={[
        {
          width,
          height,
          borderRadius: radius ?? radii.sm,
          backgroundColor: colors.surface.sunken,
        },
        animated,
        style,
      ]}
    />
  );
}

export const Skeleton = memo(SkeletonImpl);
Skeleton.displayName = "Skeleton";
