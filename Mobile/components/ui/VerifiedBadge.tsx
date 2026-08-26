/**
 * Verified badge — pixel-tight notched-circle.
 *
 * Architectural role:
 *  Replaces every prior `MaterialCommunityIcons name="check"` badge so
 *  the verified mark reads like a first-class brand element instead of
 *  a generic icon-font glyph. The notched-circle silhouette is the
 *  shape the user expects from a 2026 social network — instantly
 *  recognisable at 14px.
 *
 *  Pure SVG, no PNG asset. Two paths in one symbol so the badge
 *  background and the inner check render with a single primitive call.
 */
import React, { memo } from "react";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/hooks/useTheme";

export interface VerifiedBadgeProps {
  /** Pixel size. Default 16 reads cleanly inline with body text. */
  size?: number;
  /** Override fill colour. Defaults to the theme's primary tint. */
  color?: string;
  /** Override the inner check colour. Defaults to the contrasting onTint colour. */
  checkColor?: string;
}

/**
 * Path data taken from a 24x24 viewport. The outer notched circle uses
 * a star-on-circle silhouette (12 lobes) so the edge reads "official"
 * rather than "round sticker". The inner path is a simple chevron.
 */
const NOTCHED_CIRCLE_PATH =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z";

const CHECK_PATH = "M9.64 15.55l-3.69-3.69 1.41-1.41 2.28 2.28 6.4-6.4 1.41 1.41-7.81 7.81z";

function VerifiedBadgeImpl({ size = 16, color, checkColor }: VerifiedBadgeProps) {
  const { colors } = useTheme();
  const fill = color ?? colors.tint.primary;
  const inner = checkColor ?? colors.text.onTint;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Verified">
      <Path d={NOTCHED_CIRCLE_PATH} fill={fill} />
      <Path d={CHECK_PATH} fill={inner} />
    </Svg>
  );
}

export const VerifiedBadge = memo(VerifiedBadgeImpl);
VerifiedBadge.displayName = "VerifiedBadge";

export default VerifiedBadge;
