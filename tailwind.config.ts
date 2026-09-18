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
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Semantiniai tokenai (žr. src/app/globals.css). Viešuose puslapiuose
        // naudoti JUOS, ne `green-700` / `gray-400` atspalvių numerius.
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          card: "var(--surface-card)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          subtle: "var(--ink-subtle)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          strong: "var(--brand-strong)",
          soft: "var(--brand-soft)",
          line: "var(--brand-line)",
          ink: "var(--on-brand)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          soft: "var(--accent-soft)",
          line: "var(--accent-line)",
        },
      },
      fontFamily: {
        // --font-sans = Plus Jakarta Sans, --font-display = Fraunces
        // (abu deklaruoti src/app/layout.tsx). Fraunces turi latin-ext, todėl
        // ą/č/ę/ė/į/š/ų/ū/ž rodomi tuo pačiu šriftu, be fallback'o šuolio.
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", "Georgia", ...defaultTheme.fontFamily.serif],
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
