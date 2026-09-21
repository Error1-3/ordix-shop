import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", md: "1.5rem", lg: "2rem" }, screens: { "2xl": "1360px" } },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        // The single accent: "verified green" — used for battery health, tested, in stock.
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))", soft: "hsl(var(--accent-soft))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        warning: "hsl(var(--warning))",
      },
      borderRadius: { lg: "0.875rem", md: "0.625rem", sm: "0.375rem" },
      fontFamily: { sans: ["var(--font-onest)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "sheet-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "sheet-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "ring-fill": { from: { strokeDashoffset: "var(--ring-circ)" }, to: { strokeDashoffset: "var(--ring-offset)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "sheet-in": "sheet-in 0.28s cubic-bezier(0.22,1,0.36,1)",
        "sheet-in-left": "sheet-in-left 0.28s cubic-bezier(0.22,1,0.36,1)",
        "fade-in": "fade-in 0.2s ease-out",
        "ring-fill": "ring-fill 1.1s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
