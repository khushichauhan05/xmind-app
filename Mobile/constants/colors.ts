/**
 * Legacy `BRAND_COLORS` map.
 *
 * The new design system lives in `constants/tokens.ts` and is consumed
 * via `useTheme()`. This file is kept only as a backwards-compatibility
 * shim for the small number of leaf components that still reference the
 * legacy export, and it deliberately mirrors the new light palette so
 * the visuals match the rest of the app even before each component is
 * migrated.
 *
 * Do not add new usages.
 */
import { lightPalette } from "@/constants/tokens";

export const BRAND_COLORS = {
  PRIMARY: lightPalette.tint.primary,
  PRIMARY_LIGHT: lightPalette.tint.primarySoft,
  PRIMARY_DARK: lightPalette.tint.primaryStrong,
  SECONDARY: lightPalette.tint.accent,
  ACCENT_MINT: lightPalette.tint.success,
  ACCENT_YELLOW: lightPalette.tint.warning,
  SUCCESS: lightPalette.tint.success,
  WARNING: lightPalette.tint.warning,
  DANGER: lightPalette.tint.danger,
  BACKGROUND: lightPalette.bg.canvas,
  SURFACE: lightPalette.surface.primary,
  SURFACE_MUTED: lightPalette.surface.secondary,
  BORDER_LIGHT: "rgba(15,15,22,0.08)",
  BORDER_DARK: "rgba(15,15,22,0.16)",
  TEXT_PRIMARY: lightPalette.text.primary,
  TEXT_SECONDARY: lightPalette.text.secondary,
  PLACEHOLDER: lightPalette.text.tertiary,
  ICON_PRIMARY: lightPalette.tint.primary,
  ICON_SECONDARY: lightPalette.text.tertiary,
} as const;

export const TAB_GRADIENTS = {
  index: [BRAND_COLORS.PRIMARY, BRAND_COLORS.PRIMARY_LIGHT],
  search: [BRAND_COLORS.SECONDARY, BRAND_COLORS.PRIMARY_LIGHT],
  notifications: [BRAND_COLORS.ACCENT_MINT, BRAND_COLORS.PRIMARY],
  messages: [BRAND_COLORS.PRIMARY_LIGHT, BRAND_COLORS.PRIMARY],
  profile: [BRAND_COLORS.PRIMARY, BRAND_COLORS.PRIMARY_DARK],
} as const;

/** Kept for any header-config consumers; new code uses theme tokens. */
export const HEADER_CONFIG = {
  HEIGHT: 80,
  PADDING_HORIZONTAL: 20,
  PADDING_VERTICAL: 16,
  TITLE_SIZE: 22,
  SUBTITLE_SIZE: 13,
  BUTTON_SIZE: 40,
  BUTTON_BORDER_RADIUS: 20,
  ICON_SIZE: 20,
  BLUR_INTENSITY: 20,
  TITLE_MARGIN_BOTTOM: 4,
  BUTTON_MARGIN_LEFT: 16,
} as const;
