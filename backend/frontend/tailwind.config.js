/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14171F",
          950: "#0D0F14",
          700: "#363B47",
          500: "#5B6170",
          300: "#9BA1AC",
        },
        paper: {
          DEFAULT: "#EEF1ED",
          100: "#F7F8F6",
        },
        surface: "#FFFFFF",
        line: {
          DEFAULT: "#DCE0D8",
          subtle: "#E8EAE5",
        },
        signal: {
          50: "#ECEDFB",
          100: "#D8DAF6",
          300: "#8D90E5",
          400: "#6265DE",
          DEFAULT: "#3538CD",
          600: "#2A2CA3",
          700: "#21237E",
        },
        amber: {
          50: "#FCF3E9",
          300: "#F0C08D",
          DEFAULT: "#E08A3C",
          600: "#C06F26",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 15, 20, 0.04), 0 1px 1px rgba(14, 15, 20, 0.03)",
        lift: "0 8px 24px rgba(14, 15, 20, 0.08)",
        ring: "0 0 0 3px rgba(53, 56, 205, 0.15)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        sweep: "sweep 3s linear infinite",
      },
    },
  },
  plugins: [],
};
