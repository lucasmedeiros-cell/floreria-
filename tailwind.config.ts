import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "Editorial Atelier"
        ink: "#241A1E",
        ink2: "#6E6064",
        faint: "#9C9094",
        bg: "#F7F2EC",
        surface: "#FFFFFF",
        surface2: "#FBF6F0",
        line: "#E7DDD2",
        // ---------------------------------------------------------------
        // Color de marca = el del RUBRO activo (lib/rubros.ts). Las variables
        // las inyecta app/layout.tsx en <body> a partir de la config del
        // negocio, así que cambiar de rubro repinta toda la UI sin tocar clases.
        // Los nombres "pink*" quedaron del diseño original de la florería.
        // ---------------------------------------------------------------
        pink: "rgb(var(--c-accent) / <alpha-value>)",
        pinkDeep: "rgb(var(--c-accent-deep) / <alpha-value>)",
        pinkSoft: "rgb(var(--c-accent-soft) / <alpha-value>)",
        pinkHero: "rgb(var(--c-accent-hero) / <alpha-value>)",
        rose: "rgb(var(--c-accent) / <alpha-value>)",
        roseDeep: "rgb(var(--c-accent-deep) / <alpha-value>)",
        wine: "rgb(var(--c-accent-deep) / <alpha-value>)",
        greenOk: "#2EB872",
        gold: "#B8924A",
        goldSoft: "#CBA869",
        green: "#2F6B4F",
        success: "#2EA66B",
        dark: "#211719",
        darkSoft: "#2E2226",
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "serif"],
        sans: ["var(--font-poppins)", "sans-serif"],
        script: ["var(--font-dancing)", "cursive"],
      },
      boxShadow: {
        card: "0 10px 24px rgba(42,26,30,0.06), 0 2px 4px rgba(0,0,0,0.03)",
        cardHover: "0 18px 34px rgba(42,26,30,0.12), 0 3px 6px rgba(0,0,0,0.05)",
        soft: "0 6px 16px rgba(42,26,30,0.04)",
      },
      maxWidth: {
        shell: "1180px",
      },
    },
  },
  plugins: [],
};

export default config;
