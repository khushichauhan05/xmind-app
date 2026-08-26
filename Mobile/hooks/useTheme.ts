import { useColorScheme } from "react-native";
import { useMemo } from "react";

import {
  type ColorPalette,
  darkPalette,
  elevation,
  lightPalette,
  motion,
  radii,
  spacing,
  typography,
} from "@/constants/tokens";

export type ThemeMode = "light" | "dark";

/**
 * Theme contract consumed by every screen and component.
 * Exposes the resolved palette plus all primitive scales so consumers
 * can stay token-driven without importing constants per file.
 */
export interface Theme {
  mode: ThemeMode;
  colors: ColorPalette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
  elevation: typeof elevation;
  /** Status bar style that pairs with the resolved background. */
  statusBarStyle: "light" | "dark";
}

/**
 * Hook used everywhere to obtain the active theme. The selection follows
 * the OS preference via `useColorScheme()` so the app respects the user's
 * system-level setting and updates live when it changes.
 *
 * The returned object is memoised so consumers can pass it through
 * `useMemo` selectors and `React.memo` boundaries without churn.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === "dark" ? "dark" : "light";

  return useMemo<Theme>(
    () => ({
      mode,
      colors: mode === "dark" ? darkPalette : lightPalette,
      spacing,
      radii,
      typography,
      motion,
      elevation,
      statusBarStyle: mode === "dark" ? "light" : "dark",
    }),
    [mode]
  );
}
