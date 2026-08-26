import React, { memo, useEffect } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";

/**
 * Empty notifications state.
 *
 * The previous implementation drove the icon pulse with `setInterval`
 * — a JS-thread loop that allocated work every second forever and was
 * never cleaned up reliably. We swapped to a single `withRepeat` driver
 * on a shared value so the animation stays on the UI thread and stops
 * automatically when the component unmounts.
 */
function NoNotificationsFoundImpl() {
  const { colors, spacing, radii } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.huge,
        gap: spacing.base,
      }}
    >
      <Animated.View
        style={[
          {
            width: 80,
            height: 80,
            borderRadius: radii.pill,
            backgroundColor: colors.surface.secondary,
            alignItems: "center",
            justifyContent: "center",
          },
          iconStyle,
        ]}
      >
        <Feather name="bell" size={32} color={colors.tint.primary} />
      </Animated.View>
      <Text variant="title" tone="primary" align="center">
        It's quiet in here
      </Text>
      <Text variant="body" tone="secondary" align="center" style={{ maxWidth: 280 }}>
        Reactions, replies, and follows land here. Posting is the fastest way to start one.
      </Text>
    </View>
  );
}

export const NoNotificationsFound = memo(NoNotificationsFoundImpl);
NoNotificationsFound.displayName = "NoNotificationsFound";

export default NoNotificationsFound;
