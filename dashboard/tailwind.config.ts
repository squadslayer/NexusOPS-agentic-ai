import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Core backgrounds
                background: "#0d1117",       // Deep dark — main page bg
                surface: "#161b22",          // Panel/card bg
                surfaceHover: "#1c2128",     // Panel hover
                border: "#30363d",           // Subtle border color
                divider: "#21262d",          // Lighter divider

                // Brand / Primary Actions (AWS-inspired orange)
                primary: "#e87722",
                primaryHover: "#cc6a1f",
                primaryLight: "#f9a264",

                // Text hierarchy
                textMain: "#e6edf3",         // Primary text
                textSub: "#b1bac4",          // Secondary/muted text
                textMuted: "#6e7681",        // Disabled / placeholder

                // Status colors (AWS Console style)
                success: "#238636",
                successText: "#3fb950",
                warning: "#bb8009",
                warningText: "#e3b341",
                danger: "#da3633",
                dangerText: "#f85149",
                info: "#1f6feb",
                infoText: "#58a6ff",
            },
            fontFamily: {
                sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
                mono: ["JetBrains Mono", "ui-monospace", "monospace"],
            },
            fontSize: {
                "2xs": ["0.65rem", { lineHeight: "1rem" }],
            },
            spacing: {
                "nav-width": "15rem",       // 240px sidebar
                "header-height": "3.5rem",  // 56px top bar
            },
            borderRadius: {
                DEFAULT: "0.25rem",   // AWS uses very subtle radius
            },
            boxShadow: {
                panel: "0 0 0 1px #30363d",
                card: "0 2px 8px rgba(0,0,0,0.4)",
                dropdown: "0 8px 24px rgba(0,0,0,0.6)",
            },
            transitionDuration: {
                DEFAULT: "120ms",
            },
            animation: {
                none: "none",
            },
        },
    },
    plugins: [],
};

export default config;
