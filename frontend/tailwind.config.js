/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF8",
        ink: "#14161B",
        muted: "#6E7180",
        hairline: "#E8E6DE",
        signal: {
          DEFAULT: "#2F5EFF",
          dim: "#EEF2FF",
          deep: "#1C3FCB",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        ping1: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(1.9)", opacity: "0" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        ping1: "ping1 2.4s cubic-bezier(0,0,0.2,1) infinite",
        floatUp: "floatUp 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
};
