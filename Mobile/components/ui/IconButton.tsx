import React, { memo, useCallback } from "react";
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface IconButtonProps
  extends Omit<PressableProps, "style" | "children" | "onPress"> {
  children: React.ReactNode;
  size?: number;
  variant?: "ghost" | "tinted" | "filled" | "primary";
  onPress?: (event: GestureResponderEvent) => void;
  haptics?: boolean;
  accessibilityLabel: string;
  /** Optional badge count rendered top-right (e.g. unread inbox). */
  badge?: number;
  className?: string;
  style?: ViewStyle;
}

/**
 * IconButton.
 *
 * Adds a `primary` variant (coral fill) and a discrete badge slot for
 * the home top-bar inbox/notifications icons. Always at least 44x44
 * effective tap area via hitSlop.
 */
function IconButtonImpl({
  children,
  size = 40,
  variant = "ghost",
  onPress,
  haptics = true,
  accessibilityLabel,
  badge,
  className,
  style,
  disabled,
  ...rest
}: IconButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 18, stiffness: 360, mass: 0.5 });
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 360, mass: 0.5 });
  }, [scale]);

  const onPressInternal = useCallback(
    (e: GestureResponderEvent) => {
      if (haptics) Haptics.selectionAsync().catch(() => undefined);
      onPress?.(e);
    },
    [haptics, onPress]
  );

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg =
    variant === "filled"
      ? colors.surface.secondary
      : variant === "tinted"
      ? colors.overlay.press
      : variant === "primary"
      ? colors.tint.primary
      : "transparent";

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      onPress={onPressInternal}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      className={className}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          opacity: disabled ? 0.5 : 1,
        },
        animated,
        style,
      ]}
      {...rest}
    >
      {children}
      {badge !== undefined && badge > 0 ? (
        <Badge count={badge} />
      ) : null}
    </AnimatedPressable>
  );
}

function Badge({ count }: { count: number }) {
  const { colors } = useTheme();
  const display = count > 99 ? "99+" : String(count);
  const wide = display.length > 1;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        paddingHorizontal: wide ? 5 : 0,
        borderRadius: 9,
        backgroundColor: colors.tint.primary,
        borderWidth: 2,
        borderColor: colors.bg.canvas,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.Text
        style={{
          color: colors.text.onTint,
          fontSize: 10,
          lineHeight: 12,
          fontWeight: "800",
        }}
      >
        {display}
      </Animated.Text>
    </Animated.View>
  );
}

export const IconButton = memo(IconButtonImpl);
IconButton.displayName = "IconButton";
