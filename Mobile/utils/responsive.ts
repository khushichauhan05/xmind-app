import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;

// Base scale calculation - same as AnimatedTabContainer.tsx
export const baseScale = Math.min(
  Math.max((SCREEN_WIDTH / 430) * (aspectRatio > 2 ? 0.9 : 1), 0.85),
  1.2
);

// Responsive size functions
export const responsiveSize = (size: number) => size * baseScale;

// Responsive padding functions
export const responsivePadding = (padding: number) => padding * baseScale;

// Responsive margin functions
export const responsiveMargin = (margin: number) => margin * baseScale;

// Responsive border radius functions
export const responsiveBorderRadius = (radius: number) => radius * baseScale;

// Responsive font size functions
export const responsiveFontSize = (size: number) => size * baseScale;

// Responsive icon size functions
export const responsiveIconSize = (size: number) => size * baseScale;

// Screen dimensions
export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

// Breakpoint helpers
export const isSmallDevice = SCREEN_WIDTH < 375;
export const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
export const isLargeDevice = SCREEN_WIDTH >= 414;

// Responsive spacing scale
export const spacing = {
  xs: responsiveSize(4),
  sm: responsiveSize(8),
  md: responsiveSize(16),
  lg: responsiveSize(24),
  xl: responsiveSize(32),
  xxl: responsiveSize(48),
};

// Responsive font scale
export const fontSizes = {
  xs: responsiveFontSize(12),
  sm: responsiveFontSize(14),
  md: responsiveFontSize(16),
  lg: responsiveFontSize(18),
  xl: responsiveFontSize(20),
  xxl: responsiveFontSize(24),
  xxxl: responsiveFontSize(32),
};

// Responsive icon scale
export const iconSizes = {
  xs: responsiveIconSize(12),
  sm: responsiveIconSize(16),
  md: responsiveIconSize(20),
  lg: responsiveIconSize(24),
  xl: responsiveIconSize(32),
  xxl: responsiveIconSize(48),
};
