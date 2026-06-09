import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          light: "#3B82F6",
          dark: "#1D4ED8",
          50: "#EFF6FF",
          100: "#DBEAFE",
        },
        secondary: {
          DEFAULT: "#7C3AED",
          light: "#8B5CF6",
          dark: "#6D28D9",
        },
        success: { DEFAULT: "#22C55E", light: "#86EFAC" },
        warning: { DEFAULT: "#F59E0B", light: "#FDE68A" },
        danger: { DEFAULT: "#EF4444", light: "#FCA5A5" },
        info: { DEFAULT: "#3B82F6", light: "#93C5FD" },
        surface: "#F8FAFC",
        muted: "#94A3B8",
        border: { DEFAULT: "#E2E8F0", hover: "#CBD5E1" },
        text: { primary: "#0F172A", secondary: "#64748B", muted: "#94A3B8" },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      fontSize: {
        h1: ["40px", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["32px", { lineHeight: "1.25", fontWeight: "700" }],
        h3: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        h4: ["20px", { lineHeight: "1.35", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-reg": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      borderRadius: {
        DEFAULT: "12px",
        card: "16px",
        modal: "20px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.05)",
        elevated: "0 4px 16px rgba(0,0,0,0.08)",
        modal: "0 20px 60px rgba(0,0,0,0.15)",
        dropdown: "0 4px 12px rgba(0,0,0,0.1)",
      },
      spacing: {
        18: "72px",
      },
      height: {
        navbar: "72px",
      },
    },
  },
  plugins: [],
};

export default config;
