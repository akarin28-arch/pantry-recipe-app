import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        mincho: ["'Shippori Mincho'", "serif"],
      },
      colors: {
        pantry: {
          bg: "#faf6ee",
          card: "#fffcf5",
          border: "#e8dcc8",
          accent: "#7a6b4e",
          "accent-light": "#d4c4a8",
          text: "#3a2f1f",
          "text-mid": "#6a5b3e",
          "text-light": "#9a8a6a",
          warn: "#b8860b",
          "warn-bg": "#fff8e6",
          success: "#2d7a4f",
          "success-bg": "#edf7f0",
        },
      },
    },
  },
  plugins: [],
};
export default config;
