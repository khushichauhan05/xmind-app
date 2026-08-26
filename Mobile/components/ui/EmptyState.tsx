import React, { memo } from "react";
import { View, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { useTheme } from "@/hooks/useTheme";

export interface EmptyStateProps {
  /** Icon node (rendered inside a circular tinted container). */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Optional CTA rendered below the description. */
  action?: React.ReactNode;
  /** NativeWind utility classes. */
  className?: string;
  style?: ViewStyle;
}

/**
 * Consistent empty-state layout. Used across notifications, search,
 * and conversation lists so the absence of content always feels
 * intentional instead of broken.
 */
function EmptyStateImpl({ icon, title, description, action, className, style }: EmptyStateProps) {
  const { colors, spacing, radii } = useTheme();

  return (
    <View
      className={className}
      style={[
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.xxl,
          paddingVertical: spacing.huge,
          gap: spacing.base,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radii.pill,
            backgroundColor: colors.surface.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text variant="title" tone="primary" align="center">
        {title}
      </Text>
      {description ? (
        <Text
          variant="body"
          tone="secondary"
          align="center"
          style={{ maxWidth: 320 }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.sm }}>{action}</View> : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateImpl);
EmptyState.displayName = "EmptyState";
