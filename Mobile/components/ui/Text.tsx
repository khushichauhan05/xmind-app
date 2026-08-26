import React, { memo } from "react";
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { useTheme } from "@/hooks/useTheme";
import type { TypographyToken } from "@/constants/tokens";

type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "inverse"
  | "tint"
  | "accent"
  | "danger"
  | "success";

export interface TextProps extends RNTextProps {
  variant?: TypographyToken;
  tone?: TextTone;
  align?: TextStyle["textAlign"];
  weight?: TextStyle["fontWeight"];
  className?: string;
}

/**
 * Themed Text primitive. Routes every label in the app through one
 * type ramp + palette so the visual language stays coherent in both
 * schemes. The `accent` tone maps to the communications blue (Facebook
 * link colour) so mentions and hyperlinks read as actionable rather
 * than as headings.
 */
function ThemedTextImpl({
  variant = "body",
  tone = "primary",
  align,
  weight,
  style,
  ...rest
}: TextProps) {
  const { typography, colors } = useTheme();
  const t = typography[variant];

  const color =
    tone === "primary"
      ? colors.text.primary
      : tone === "secondary"
      ? colors.text.secondary
      : tone === "tertiary"
      ? colors.text.tertiary
      : tone === "inverse"
      ? colors.text.inverse
      : tone === "tint"
      ? colors.tint.primary
      : tone === "accent"
      ? colors.tint.accent
      : tone === "danger"
      ? colors.tint.danger
      : colors.tint.success;

  return (
    <RNText
      allowFontScaling
      style={StyleSheet.flatten([
        {
          fontSize: t.size,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          fontWeight: (weight ?? t.weight) as TextStyle["fontWeight"],
          color,
          textAlign: align,
        },
        style,
      ])}
      {...rest}
    />
  );
}

export const Text = memo(ThemedTextImpl);
Text.displayName = "Text";
