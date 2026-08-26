import React, { memo, useCallback, useEffect } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";

export interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

export type AlertType = "default" | "success" | "error" | "warning" | "info";

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
  type?: AlertType;
}

/**
 * Themed confirmation / message alert.
 *
 * Replaces the legacy iOS-only blur+gradient stack with the platform-aware
 * Surface primitive so Android shows a flat themed sheet (no BlurView)
 * while iOS 26+ shows real Liquid Glass and iOS<26 falls back to BlurView.
 *
 * Tap-to-dismiss on the scrim is enabled — Cialdini's reciprocity meets
 * UI ergonomics: removing the friction of a "Cancel" button when there's
 * nothing destructive to confirm respects the user's time.
 */
function CustomAlertImpl({
  visible,
  title,
  message,
  buttons = [{ text: "OK" }],
  onDismiss,
  type = "default",
}: CustomAlertProps) {
  const { colors, spacing, radii } = useTheme();
  const sheetProgress = useSharedValue(0);

  useEffect(() => {
    sheetProgress.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [visible, sheetProgress]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value,
    transform: [{ scale: 0.96 + sheetProgress.value * 0.04 }],
  }));

  const handleBackdropPress = useCallback(() => {
    // Only allow scrim-tap dismissal when there's a single non-destructive
    // affordance — destructive flows must require an explicit choice.
    const single = buttons.length === 1 && buttons[0]?.style !== "destructive";
    if (single) onDismiss?.();
  }, [buttons, onDismiss]);

  const tone =
    type === "success"
      ? colors.tint.success
      : type === "error"
      ? colors.tint.danger
      : type === "warning"
      ? colors.tint.warning
      : colors.tint.primary;

  const icon: keyof typeof Feather.glyphMap =
    type === "success"
      ? "check-circle"
      : type === "error"
      ? "alert-circle"
      : type === "warning"
      ? "alert-triangle"
      : "info";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
        }}
        onPress={handleBackdropPress}
      >
        {/* Stop propagation so taps inside the sheet don't dismiss. */}
        <Pressable onPress={() => undefined}>
          <Animated.View style={sheetStyle}>
            <Surface
              variant="solid"
              radius={radii.xl}
              style={{
                width: 320,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border.subtle,
                gap: spacing.md,
              }}
            >
              {type !== "default" ? (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radii.pill,
                    backgroundColor: colors.surface.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                    alignSelf: "flex-start",
                  }}
                >
                  <Feather name={icon} size={22} color={tone} />
                </View>
              ) : null}

              <View>
                <Text variant="title" tone="primary">
                  {title}
                </Text>
                <Text variant="body" tone="secondary" style={{ marginTop: spacing.xs }}>
                  {message}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: buttons.length > 2 ? "column" : "row",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                {buttons.map((btn, i) => (
                  <Button
                    key={`${btn.text}-${i}`}
                    label={btn.text}
                    fullWidth={buttons.length > 2}
                    variant={
                      btn.style === "destructive"
                        ? "danger"
                        : btn.style === "cancel"
                        ? "secondary"
                        : "primary"
                    }
                    onPress={() => {
                      btn.onPress?.();
                      onDismiss?.();
                    }}
                  />
                ))}
              </View>
            </Surface>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const CustomAlert = memo(CustomAlertImpl);
CustomAlert.displayName = "CustomAlert";

export default CustomAlert;
