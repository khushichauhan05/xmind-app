import React, { forwardRef, memo, useCallback, useState } from "react";
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";

import { Text } from "./Text";
import { useTheme } from "@/hooks/useTheme";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  helper?: string;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerStyle?: ViewStyle;
  /**
   * Visual treatment of the input. `pill` is the IG-search aesthetic
   * (rounded-pill on a sunken surface); `panel` is the FB-form aesthetic
   * (rounded-md on a solid card with stronger borders).
   */
  shape?: "pill" | "panel";
}

/**
 * TextField.
 *
 * Adds the `pill` variant used by the new search/inbox bars. Focus ring
 * picks up the coral primary, so the eye lands on the active field.
 */
const TextFieldImpl = forwardRef<TextInput, TextFieldProps>(function TextFieldImpl(
  {
    label,
    helper,
    error,
    leading,
    trailing,
    containerStyle,
    shape = "panel",
    style,
    onFocus,
    onBlur,
    placeholderTextColor,
    ...rest
  },
  ref
) {
  const { colors, radii, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  const borderColor = error
    ? colors.tint.danger
    : focused
    ? colors.border.focus
    : colors.border.subtle;

  const isPill = shape === "pill";
  const isMultiline = !!rest.multiline;
  const radius = isPill ? radii.pill : radii.lg;
  // Multiline fields need the wrapper to grow with content. Single-line
  // fields stay at a fixed touch-target height (44 / 52). We use
  // `minHeight` for multiline so a long bio stretches the wrapper instead
  // of overflowing it (which is what made the text appear *above* the
  // field rather than inside it).
  const baseHeight = isPill ? 44 : 52;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: isMultiline ? "flex-start" : "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.base,
          paddingVertical: isMultiline ? spacing.md : 0,
          ...(isMultiline ? { minHeight: baseHeight } : { height: baseHeight }),
          borderRadius: radius,
          backgroundColor: colors.surface.secondary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor,
        }}
      >
        {leading}
        <TextInput
          ref={ref}
          placeholderTextColor={placeholderTextColor ?? colors.text.tertiary}
          textAlignVertical={isMultiline ? "top" : "center"}
          style={StyleSheet.flatten([
            {
              flex: 1,
              fontSize: typography.body.size,
              lineHeight: typography.body.lineHeight,
              color: colors.text.primary,
              padding: 0,
              ...(isMultiline ? { minHeight: 80 } : null),
            },
            style,
          ])}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
        {trailing}
      </View>

      {error || helper ? (
        <Text
          variant="caption"
          tone={error ? "danger" : "tertiary"}
          style={{ marginTop: spacing.xs }}
        >
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
});

export const TextField = memo(TextFieldImpl);
TextField.displayName = "TextField";
