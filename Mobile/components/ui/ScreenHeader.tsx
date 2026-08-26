import React, { memo } from "react";
import { View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { Surface } from "./Surface";
import { useTheme } from "@/hooks/useTheme";

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Slot rendered to the left of the title (back button, logo). */
  leading?: React.ReactNode;
  /** Slot rendered to the right of the title (actions). */
  trailing?: React.ReactNode;
  /** When true, header sits over content with a glass surface. */
  floating?: boolean;
  align?: "left" | "center";
  style?: ViewStyle;
}

/**
 * Unified screen header. Adapts its surface to the platform via the
 * Surface primitive (glass on iOS 26+, blur on iOS<26, flat on Android).
 *
 * Psychology notes:
 *  - Single point of orientation per screen — reduces scanning cost.
 *  - Subtitle adds context without doubling the title height.
 *  - Generous tap area for leading/trailing slots (Fitts's Law).
 */
function ScreenHeaderImpl({
  title,
  subtitle,
  leading,
  trailing,
  floating = false,
  align = "left",
  style,
}: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const Inner = (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      {leading ? <View>{leading}</View> : null}

      <View
        style={{
          flex: 1,
          alignItems: align === "center" ? "center" : "flex-start",
        }}
      >
        <Text variant="title" tone="primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View>{trailing}</View> : null}
    </View>
  );

  if (floating) {
    return (
      <Surface
        variant="glass"
        style={[
          {
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
          },
          style,
        ]}
      >
        {Inner}
      </Surface>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: colors.bg.canvas,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        },
        style,
      ]}
    >
      {Inner}
    </View>
  );
}

export const ScreenHeader = memo(ScreenHeaderImpl);
ScreenHeader.displayName = "ScreenHeader";
