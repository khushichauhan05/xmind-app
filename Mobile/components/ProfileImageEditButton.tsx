import React, { memo } from "react";
import { ActivityIndicator, Pressable, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";

export interface ProfileImageEditButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  size?: "small" | "medium" | "large";
  position?: "top-right" | "bottom-right" | "center" | "above-profile";
  variant?: "profile" | "banner";
  style?: ViewStyle;
}

/**
 * Floating edit-image affordance pinned over an image. Themed via
 * `useTheme` so it adapts to dark mode automatically.
 */
function ProfileImageEditButtonImpl({
  onPress,
  isLoading = false,
  size = "medium",
  position = "bottom-right",
  variant = "profile",
  style,
}: ProfileImageEditButtonProps) {
  const { colors, spacing } = useTheme();

  const dim = size === "small" ? 32 : size === "large" ? 48 : 40;
  const iconSize = size === "small" ? 14 : size === "large" ? 22 : 18;

  const positionStyle: ViewStyle =
    position === "top-right"
      ? { top: spacing.sm, right: spacing.sm }
      : position === "bottom-right"
      ? { bottom: spacing.sm, right: spacing.sm }
      : position === "above-profile"
      ? { top: -spacing.lg, right: spacing.sm }
      : { top: spacing.sm, left: spacing.sm };

  const isProfile = variant === "profile";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edit image"
      accessibilityState={{ busy: isLoading }}
      onPress={onPress}
      disabled={isLoading}
      style={[
        {
          position: "absolute",
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isProfile ? colors.tint.primary : colors.surface.primary,
          borderWidth: 2,
          borderColor: isProfile ? colors.surface.primary : colors.tint.primary,
          zIndex: 10,
        },
        positionStyle,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={isProfile ? colors.text.onTint : colors.tint.primary} />
      ) : (
        <Feather
          name="edit-3"
          size={iconSize}
          color={isProfile ? colors.text.onTint : colors.tint.primary}
        />
      )}
    </Pressable>
  );
}

export const ProfileImageEditButton = memo(ProfileImageEditButtonImpl);
ProfileImageEditButton.displayName = "ProfileImageEditButton";

export default ProfileImageEditButton;
