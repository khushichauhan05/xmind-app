import React, { memo, useMemo } from "react";
import { type ImageStyle, View, type ViewStyle } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "./Text";
import { useTheme } from "@/hooks/useTheme";
import { storyRingGradient } from "@/constants/tokens";

export interface AvatarProps {
  source?: ImageSource | string | number | null;
  /** Used to generate fallback initials when no image is available. */
  name?: string;
  size?: number;
  /** Solid ring around the avatar (verified profile, etc). */
  ringColor?: string;
  /** Instagram-style gradient story ring around the avatar. */
  story?: boolean;
  /** When `story` is true, dims the ring to neutral once viewed. */
  storyViewed?: boolean;
  className?: string;
  style?: ViewStyle;
}

function initialsFor(name?: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

/**
 * Avatar primitive.
 *
 * Adds a `story` mode that wraps the avatar in a gradient ring (Instagram
 * Stories aesthetic) for the home Stories rail. Dimmed when `storyViewed`.
 * Initials fallback prevents layout shift while the network image lands.
 */
function AvatarImpl({
  source,
  name,
  size = 44,
  ringColor,
  story,
  storyViewed,
  className,
  style,
}: AvatarProps) {
  const { colors } = useTheme();

  const resolvedSource = useMemo<ImageSource | number | null>(() => {
    if (source == null) return null;
    if (typeof source === "string") {
      const trimmed = source.trim();
      return trimmed ? { uri: trimmed } : null;
    }
    return source;
  }, [source]);

  const ringPad = story ? 3 : ringColor ? 2 : 0;
  const innerPad = story ? 2 : 0;
  const innerSize = size - ringPad * 2;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    alignItems: "center",
    justifyContent: "center",
  };

  const inner: ViewStyle = {
    width: innerSize,
    height: innerSize,
    borderRadius: innerSize / 2,
    overflow: "hidden",
    backgroundColor: colors.surface.secondary,
    alignItems: "center",
    justifyContent: "center",
  };

  const innerWithBorder: ViewStyle = story
    ? {
        ...inner,
        borderWidth: innerPad,
        borderColor: colors.bg.canvas,
      }
    : ringColor
    ? { ...inner, borderWidth: 2, borderColor: ringColor }
    : inner;

  const imageStyle: ImageStyle = {
    width: innerSize - innerPad * 2,
    height: innerSize - innerPad * 2,
    borderRadius: (innerSize - innerPad * 2) / 2,
  };

  const Avatar = (
    <View style={innerWithBorder}>
      {resolvedSource ? (
        <Image
          source={resolvedSource}
          style={imageStyle}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : (
        <Text
          variant={size >= 56 ? "title" : "label"}
          tone="secondary"
          weight="700"
          style={{ fontSize: Math.max(12, size * 0.38) }}
        >
          {initialsFor(name)}
        </Text>
      )}
    </View>
  );

  if (story) {
    return (
      <View className={className} style={[containerStyle, style]}>
        <LinearGradient
          colors={
            storyViewed
              ? [colors.border.strong, colors.border.subtle]
              : (storyRingGradient as unknown as [string, string, string])
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Avatar}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View className={className} style={[containerStyle, style]}>
      {Avatar}
    </View>
  );
}

export const Avatar = memo(AvatarImpl);
Avatar.displayName = "Avatar";
