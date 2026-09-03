import type { Config } from "tailwindcss";

// Palette ported 1:1 from the original SwiftUI `AppTheme` so the web/desktop
// rewrite keeps the exact LunaDesk look and feel.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        luna: {
          window: "#151515",
          content: "#222222",
          elevated: "#303030",
          selected: "#292929",
          stroke: "rgba(255,255,255,0.09)",
          primary: "#e0e0e0",
          secondary: "#7a7a80",
          bubble: "#e0e0db",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
