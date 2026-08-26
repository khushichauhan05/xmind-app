import React, { memo, useMemo } from "react";
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { useTheme } from "@/hooks/useTheme";

/**
 * Surface — single primitive that handles every translucent / opaque
 * background in the app. Variants are presentational intent, not
 * implementation:
 *
 *   glass   → iOS 26+ Liquid Glass; iOS <26 BlurView; Android flat tint.
 *             Per project policy: BlurView NEVER on Android.
 *   solid   → Opaque themed surface for cards and panels.
 *   sunken  → Recessed input/section background.
 *   raised  → Elevated card with theme-aware shadow.
 *
 * The glass branch is the reason this component exists — without it
 * every screen would have to Platform.select itself, and Android low-end
 * devices would suffer the BlurView tax.
 */
export type SurfaceVariant = "glass" | "solid" | "sunken" | "raised";

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  radius?: number;
  /** Glass intensity (BlurView fallback only). Ignored on iOS 26+ and Android. */
  intensity?: number;
  /** Glass tint hint. iOS 26 Liquid Glass uses the explicit value; BlurView maps light/dark. */
  tintColor?: string;
  /** iOS 26+ interactive material highlight. */
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const isIOS = Platform.OS === "ios";
const liquidGlassReady = isIOS && isLiquidGlassAvailable();

function SurfaceImpl({
  variant = "solid",
  radius,
  intensity = 32,
  tintColor,
  interactive = false,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { colors, mode, elevation } = useTheme();

  const baseStyle = useMemo<ViewStyle>(() => {
    const r: ViewStyle = {};
    if (radius != null) r.borderRadius = radius;
    return r;
  }, [radius]);

  if (variant === "glass") {
    if (liquidGlassReady) {
      return (
        <GlassView
          style={[baseStyle, style]}
          glassEffectStyle="regular"
          tintColor={tintColor}
          isInteractive={interactive}
          {...(rest as ViewProps)}
        >
          {children}
        </GlassView>
      );
    }

    if (isIOS) {
      const blurTint: BlurTint = mode === "dark" ? "dark" : "light";
      return (
        <BlurView
          tint={blurTint}
          intensity={intensity}
          style={[baseStyle, style]}
          {...(rest as ViewProps)}
        >
          {children}
        </BlurView>
      );
    }

    // Android — flat tint. Never BlurView.
    return (
      <View
        style={[
          {
            backgroundColor: colors.overlay.glassTint,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border.subtle,
          },
          baseStyle,
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  const surfaceColor =
    variant === "sunken"
      ? colors.surface.sunken
      : variant === "raised"
      ? colors.surface.raised
      : colors.surface.primary;

  const raisedShadow: ViewStyle =
    variant === "raised"
      ? {
          shadowColor: "#000",
          shadowOffset: elevation.md.shadowOffset,
          shadowOpacity: mode === "dark" ? 0.5 : elevation.md.shadowOpacity,
          shadowRadius: elevation.md.shadowRadius,
          elevation: elevation.md.elevation,
        }
      : {};

  return (
    <View
      style={[{ backgroundColor: surfaceColor }, raisedShadow, baseStyle, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export const Surface = memo(SurfaceImpl);
Surface.displayName = "Surface";
