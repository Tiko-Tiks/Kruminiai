import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        // Semantiniai tokenai (žr. src/app/globals.css). Viešuose puslapiuose
        // naudoti JUOS, ne `green-700` / `gray-400` atspalvių numerius.
        //
        // `rgb(var(--x) / <alpha-value>)`, o ne `var(--x)`: kitaip Tailwind
        // TYLIAI praleidžia permatomumo modifikatorius (`bg-surface/90`) ir
        // klasė iš viso nesugeneruojama.
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
          card: "rgb(var(--surface-card) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--line) / <alpha-value>)",
          strong: "rgb(var(--line-strong) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          subtle: "rgb(var(--ink-subtle) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          strong: "rgb(var(--brand-strong) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          line: "rgb(var(--brand-line) / <alpha-value>)",
          ink: "rgb(var(--on-brand) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          strong: "rgb(var(--accent-strong) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          line: "rgb(var(--accent-line) / <alpha-value>)",
        },
      },
      fontFamily: {
        // --font-sans = Plus Jakarta Sans (deklaruota src/app/layout.tsx).
        // Fallback'as – sistemos sans-serif šriftai (Tailwind default'as).
        // Antraštėms ATSKIRO šrifto NEDEDAM – serif (Fraunces) buvo išbandytas
        // ir atmestas; svetainė lieka vienos šriftų šeimos.
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // Fluid skalė – be `md:text-5xl lg:text-6xl` kaskadų kiekvienoje antraštėje
        "display-lg": ["clamp(2.5rem, 1.6rem + 3.6vw, 4.25rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.9rem, 1.5rem + 1.8vw, 2.75rem)", { lineHeight: "1.12", letterSpacing: "-0.015em" }],
        "display-sm": ["clamp(1.5rem, 1.3rem + 0.9vw, 2rem)", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        // Skaitomas kūno tekstas (17px) – 14px `text-sm` straipsniams buvo per smulkus
        prose: ["1.0625rem", { lineHeight: "1.7" }],
      },
      maxWidth: {
        // Skaitymo matas – ~68 simboliai eilutėje
        prose: "68ch",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(0.75rem)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-up": "fade-up 500ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
