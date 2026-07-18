import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta easy pos (misma que la app móvil, lib/theme.dart).
        ink: "#201A17",
        ink2: "#6B615B",
        faint: "#9A928C",
        bg: "#F6F4F1",
        surface: "#FFFFFF",
        surface2: "#F7F4F0",
        line: "#E7E1DA",
        // ---------------------------------------------------------------
        // Colores de easy pos (amarillo + negro), FIJOS. Las variables las
        // inyecta app/globals.css / app/layout.tsx; son las mismas siempre.
        // Los nombres "pink*" quedaron del diseño original de la florería.
        //   pink*  = amarillo (fondos, botones, bordes, chips, hero)
        //   onAccent = negro, para TEXTO sobre el amarillo (botones)
        // ---------------------------------------------------------------
        pink: "rgb(var(--c-accent) / <alpha-value>)",
        pinkDeep: "rgb(var(--c-accent-deep) / <alpha-value>)",
        pinkSoft: "rgb(var(--c-accent-soft) / <alpha-value>)",
        pinkHero: "rgb(var(--c-accent-hero) / <alpha-value>)",
        rose: "rgb(var(--c-accent) / <alpha-value>)",
        roseDeep: "rgb(var(--c-accent-deep) / <alpha-value>)",
        wine: "rgb(var(--c-accent-deep) / <alpha-value>)",
        onAccent: "rgb(var(--c-on-accent) / <alpha-value>)",
        // Amarillo claro del header curvo (fijo, no depende del negocio).
        accentLight: "#FFC93C",
        greenOk: "#2EB872",
        gold: "#B8924A",
        goldSoft: "#CBA869",
        green: "#2F6B4F",
        success: "#2EA66B",
        error: "#E0324E",
        dark: "#17120F",
        darkSoft: "#2A2320",
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
