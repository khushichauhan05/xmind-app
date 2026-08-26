/** @type {import('tailwindcss').Config} */
//
// xMind 2026 — coral / magenta / sky palette mirrored from
// `Mobile/constants/tokens.ts`. Color tokens resolve to CSS variables
// declared in `global.css` so light/dark switches happen at the variable
// layer without `dark:` prefixes scattered through screens.
//
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        // ── Brand (stable across themes) ────────────────────────────────
        brand: {
          DEFAULT: "#F0466A",
          strong: "#E11D48",
          soft: "#FB7185",
        },
        magenta: "#C026D3",
        peach: "#FB923C",
        sky: {
          DEFAULT: "#1B7CE8",
          soft: "#60A5FA",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#DC2626",

        // ── Semantic surfaces (auto-flip via CSS variables) ─────────────
        canvas: "var(--color-bg-canvas)",
        elevated: "var(--color-bg-elevated)",
        muted: "var(--color-bg-muted)",
        surface: {
          DEFAULT: "var(--color-surface)",
          secondary: "var(--color-surface-secondary)",
          raised: "var(--color-surface-raised)",
          sunken: "var(--color-surface-sunken)",
        },
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        tertiary: "var(--color-text-tertiary)",
        inverse: "var(--color-text-inverse)",

        tint: {
          DEFAULT: "var(--color-tint-primary)",
          strong: "var(--color-tint-primary-strong)",
          soft: "var(--color-tint-primary-soft)",
          accent: "var(--color-tint-accent)",
        },
      },
      borderColor: {
        subtle: "var(--color-border-subtle)",
        strong: "var(--color-border-strong)",
        DEFAULT: "var(--color-border-subtle)",
      },
      // ── Spacing — 4px baseline grid (mirrors tokens.spacing) ─────────
      spacing: {
        xxs: "2px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        base: "16px",
        lg: "20px",
        xl: "24px",
        xxl: "32px",
        xxxl: "40px",
        huge: "56px",
        giant: "72px",
      },
      // ── Type scale (mirrors tokens.typography) ───────────────────────
      fontSize: {
        caption: ["11px", { lineHeight: "14px", letterSpacing: "0.3px" }],
        label: ["13px", { lineHeight: "16px", letterSpacing: "0.2px" }],
        bodySm: ["13px", { lineHeight: "18px" }],
        body: ["15px", { lineHeight: "22px" }],
        bodyLg: ["17px", { lineHeight: "24px" }],
        subtitle: ["17px", { lineHeight: "22px", letterSpacing: "-0.1px" }],
        title: ["22px", { lineHeight: "28px", letterSpacing: "-0.4px" }],
        headline: ["30px", { lineHeight: "36px", letterSpacing: "-0.7px" }],
        display: ["44px", { lineHeight: "50px", letterSpacing: "-1.4px" }],
      },
      // ── Radii (mirrors tokens.radii) ─────────────────────────────────
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        base: "14px",
        lg: "18px",
        xl: "22px",
        xxl: "28px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};
