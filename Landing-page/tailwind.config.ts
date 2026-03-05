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
        background: "#0B0F19",
        surface: "#121826",
        primary: "#4F46E5",
        "text-primary": "#F9FAFB",
        "text-secondary": "#9CA3AF",
      },
      maxWidth: {
        container: "1200px",
      },
      padding: {
        section: "100px",
        card: "24px",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
