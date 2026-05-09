import type { Config } from "tailwindcss";
import prelinePlugin from "preline/plugin";

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/preline/dist/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        surface: {
          DEFAULT: "rgb(15 23 42)",
          subtle: "rgb(2 6 23)",
          muted: "rgb(30 41 59)",
          raised: "rgb(51 65 85)",
        },
      },
      borderRadius: {
        xl: "0.875rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255, 255, 255, 0.04) inset, 0 1px 2px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [prelinePlugin as never],
} satisfies Config;
