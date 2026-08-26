import React, { memo, useEffect } from "react";
import { View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";

export interface VerificationProgressProps {
  isVerified?: boolean;
  progress: number;
  statusMessage: string;
  missingRequirements: string[];
  isEligible: boolean;
  isChecking: boolean;
  onVerificationRequest: () => void;
}

/**
 * Verification card.
 *
 * Behavioural notes:
 *  - Progress bar is animated on the UI thread; the percentage is
 *    visible at all times so users can see their proximity to the goal
 *    (Goal-Gradient Effect — closer to the finish, more motivation).
 *  - Missing requirements are listed but capped at the first two —
 *    showing more risks decision paralysis (Hick's Law).
 */
function VerificationProgressImpl({
  isVerified,
  progress,
  statusMessage,
  missingRequirements,
  isEligible,
  isChecking,
  onVerificationRequest,
}: VerificationProgressProps) {
  const { colors, spacing, radii } = useTheme();

  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(100, progress)), { duration: 600 });
  }, [progress, width]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  if (isVerified) {
    return (
      <Card variant="solid" style={{ borderWidth: 1, borderColor: colors.border.subtle }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.pill,
              backgroundColor: colors.surface.secondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="check-decagram" size={20} color={colors.tint.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="subtitle" tone="primary">
              Verified
            </Text>
            <Text variant="bodySm" tone="secondary">
              Your badge shows up next to your name everywhere on xMind.
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card variant="solid" style={{ borderWidth: 1, borderColor: colors.border.subtle, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.pill,
            backgroundColor: colors.surface.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather
            name={isEligible ? "check-circle" : "clock"}
            size={18}
            color={isEligible ? colors.tint.primary : colors.tint.warning}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subtitle" tone="primary">
            Verification
          </Text>
          <Text variant="bodySm" tone="secondary" numberOfLines={2}>
            {statusMessage}
          </Text>
        </View>
        <Button
          label={isChecking ? "Checking" : isEligible ? "Request" : "Complete"}
          size="sm"
          variant={isEligible ? "primary" : "secondary"}
          loading={isChecking}
          disabled={!isEligible && !isChecking}
          onPress={onVerificationRequest}
        />
      </View>

      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.surface.sunken,
          overflow: "hidden",
          marginTop: spacing.sm,
        }}
      >
        <Animated.View
          style={[
            { height: "100%", backgroundColor: colors.tint.primary },
            barStyle,
          ]}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="caption" tone="tertiary">
          {Math.round(progress)}% complete
        </Text>
        {missingRequirements.length > 0 ? (
          <Text variant="caption" tone="tertiary">
            {missingRequirements.length} left
          </Text>
        ) : null}
      </View>

      {missingRequirements.length > 0 && missingRequirements.length <= 2 ? (
        <View style={{ marginTop: spacing.xs, gap: 2 }}>
          {missingRequirements.slice(0, 2).map((req, i) => (
            <Text key={i} variant="caption" tone="secondary">
              • {req}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export const VerificationProgress = memo(VerificationProgressImpl);
VerificationProgress.displayName = "VerificationProgress";

export default VerificationProgress;
