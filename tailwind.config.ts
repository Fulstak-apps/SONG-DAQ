import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: "rgb(var(--color-white) / <alpha-value>)",
        black: "rgb(var(--color-black) / <alpha-value>)",
        "pure-white": "#FFFFFF",
        "pure-black": "#000000",
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel2)",
        edge: "var(--edge)",
        ink: "var(--ink)",
        mute: "var(--mute)",
        neon: "rgb(var(--color-neon) / <alpha-value>)",
        neondim: "rgb(var(--color-neondim) / <alpha-value>)",
        violet: "rgb(var(--color-violet) / <alpha-value>)",
        red: "#FF3366",
        gold: "#D4AF37",
        platinum: "#E5E4E2",
        bronze: "#CD7F32",
        silver: "#C0C0C0",
        cyan: "rgb(var(--color-cyan) / <alpha-value>)",
        rose: "#FF6B9D",
        amber: "#F59E0B",
        emerald: "#10B981",
        sky: "#0EA5E9",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "Cambria", "Times New Roman", "Times", "serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 30px rgba(0,229,114,0.15)",
        glowv: "0 0 30px rgba(155,81,224,0.15)",
        glowg: "0 0 30px rgba(212,175,55,0.15)",
        glowc: "0 0 30px rgba(0,212,255,0.15)",
        surface: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        "card-hover": "0 20px 40px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        "card-luxury": "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        "neon-glow": "0 0 20px rgba(0,229,114,0.25), 0 0 60px rgba(0,229,114,0.1)",
        "violet-glow": "0 0 20px rgba(155,81,224,0.25), 0 0 60px rgba(155,81,224,0.1)",
        "gold-glow": "0 0 20px rgba(212,175,55,0.25), 0 0 60px rgba(212,175,55,0.1)",
        "depth": "0 24px 48px -12px rgba(0,0,0,0.6), 0 12px 24px -8px rgba(0,0,0,0.4)",
        "inner-glow": "inset 0 0 30px rgba(255,255,255,0.03)",
      },
      backdropBlur: { xs: "2px" },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        tickerV: {
          "0%": { transform: "translateY(0%)" },
          "100%": { transform: "translateY(-50%)" },
        },
        pulseDot: {
          "0%,100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glow: {
          "0%,100%": { boxShadow: "0 0 15px rgba(0,229,114,0.2)" },
          "50%": { boxShadow: "0 0 30px rgba(0,229,114,0.4)" },
        },
        breathe: {
          "0%,100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(-20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        countUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        orbFloat: {
          "0%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(30px,-20px) scale(1.1)" },
          "66%": { transform: "translate(-20px,10px) scale(0.95)" },
          "100%": { transform: "translate(0,0) scale(1)" },
        },
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        reveal: {
          "0%": { clipPath: "inset(0 100% 0 0)" },
          "100%": { clipPath: "inset(0 0 0 0)" },
        },
      },
      animation: {
        ticker: "ticker 40s linear infinite",
        "ticker-v": "tickerV 40s linear infinite",
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
        breathe: "breathe 4s ease-in-out infinite",
        slideUp: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1)",
        slideIn: "slideIn 0.4s cubic-bezier(0.16,1,0.3,1)",
        countUp: "countUp 0.6s cubic-bezier(0.16,1,0.3,1)",
        orbFloat: "orbFloat 20s ease-in-out infinite",
        gradientShift: "gradientShift 8s ease infinite",
        pulseRing: "pulseRing 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        reveal: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
