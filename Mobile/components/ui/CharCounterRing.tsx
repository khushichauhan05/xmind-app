/**
 * Character-counter ring — Twitter-style.
 *
 * Architectural role:
 *  Visualises remaining characters as a fillable arc instead of a digit
 *  count. Three stages: progress (tint), warning (last 30 chars, tint
 *  shifts to warning), overrun (full ring + numeric overflow indicator).
 *
 * Psychology lever:
 *  Pre-emptive feedback. The ring telegraphs "you're approaching the
 *  limit" at a glance, in the user's peripheral vision, without their
 *  having to read a number — a rare case where ambient information
 *  outperforms explicit data.
 */
import React, { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "./Text";
import { useTheme } from "@/hooks/useTheme";

export interface CharCounterRingProps {
  current: number;
  max: number;
  /** Outer diameter in px. Defaults to 22. */
  size?: number;
  /** Stroke width relative to size. */
  strokeWidth?: number;
  /** Distance under max where the ring shifts to warning state. */
  warnAt?: number;
}

function CharCounterRingImpl({
  current,
  max,
  size = 22,
  strokeWidth = 2.5,
  warnAt = 30,
}: CharCounterRingProps) {
  const { colors } = useTheme();

  const remaining = max - current;
  const overrun = remaining < 0;
  const warn = remaining <= warnAt && remaining >= 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Cap progress visual at 1 even when overrun, so the ring stays full
  // and the numeric overflow takes over communication.
  const progress = useMemo(() => {
    if (max <= 0) return 0;
    return Math.min(current / max, 1);
  }, [current, max]);

  const strokeColor = overrun
    ? colors.tint.danger
    : warn
    ? colors.tint.warning
    : colors.tint.primary;

  const dashOffset = circumference * (1 - progress);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel={
        overrun
          ? `${-remaining} characters over limit`
          : `${remaining} characters remaining`
      }
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surface.sunken}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      {overrun ? (
        <View
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
            width: size,
            height: size,
          }}
        >
          <Text
            variant="caption"
            tone="danger"
            weight="700"
            style={{ fontSize: 9, lineHeight: 10 }}
          >
            {-remaining}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const CharCounterRing = memo(CharCounterRingImpl);
CharCounterRing.displayName = "CharCounterRing";

export default CharCounterRing;
