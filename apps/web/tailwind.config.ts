import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#070a0f",
        surface: "#0d1119",
        surface2: "#111824",
        surface3: "#161e2e",
        border: "rgba(255,255,255,0.07)",
        border2: "rgba(255,255,255,0.12)",
        text: "#dce4f0",
        muted: "#475569",
        faint: "#1e2535",
        sharp: {
          green: "#10b981",
          red: "#ef4444",
          amber: "#f59e0b",
          blue: "#60a5fa",
          purple: "#a78bfa",
          teal: "#2dd4bf",
        },
      },
      fontFamily: {
        display: ["Syne", "system-ui", "sans-serif"],
        mono: ["DM Mono", "SF Mono", "monospace"],
        body: ["system-ui", "-apple-system", "sans-serif"],
      },
      keyframes: {
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0)" },
          "50%": { boxShadow: "0 0 0 4px rgba(16,185,129,0.2)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "slide-in": "slide-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
