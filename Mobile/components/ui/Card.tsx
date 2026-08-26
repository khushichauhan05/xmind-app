import React, { memo } from "react";
import { type ViewStyle } from "react-native";

import { Surface, type SurfaceVariant } from "./Surface";
import { useTheme } from "@/hooks/useTheme";

export interface CardProps {
  children: React.ReactNode;
  variant?: SurfaceVariant;
  padding?: number;
  radius?: number;
  fullWidth?: boolean;
  /** Render a hairline border. Defaults to true on solid; false on glass. */
  bordered?: boolean;
  className?: string;
  style?: ViewStyle;
}

/**
 * Card — composes Surface with the standard card padding and the new
 * 18px radius. Cards on the new feed feel posted, not stamped. The
 * border is opt-in: most full-bleed media cards skip it; profile and
 * sidebar cards keep it.
 */
function CardImpl({
  children,
  variant = "solid",
  padding,
  radius,
  fullWidth = true,
  bordered,
  className,
  style,
}: CardProps) {
  const { spacing, radii, colors } = useTheme();
  const r = radius ?? radii.lg;
  const p = padding ?? spacing.base;

  const wantsBorder = bordered ?? variant !== "glass";

  return (
    <Surface
      variant={variant}
      radius={r}
      className={className}
      style={{
        padding: p,
        alignSelf: fullWidth ? "stretch" : "auto",
        ...(wantsBorder
          ? { borderWidth: 1, borderColor: colors.border.subtle }
          : null),
        ...style,
      }}
    >
      {children}
    </Surface>
  );
}

export const Card = memo(CardImpl);
Card.displayName = "Card";
