/** @type {import('tailwindcss').Config} */
// Design tokens: see DESIGN.md at the repo root. New code uses these names (bg-brand,
// text-brand-ink, rounded-card, min-h-tap…) instead of raw hex values.
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#056559", // primary buttons, links, active states (light)
          hover: "#03443c",
          ink: "#035048", // brand-coloured text on mint
          mint: "#eefbf7", // tinted surfaces (footer, notices)
          dark: "#2dd4bf", // primary in dark mode (teal-400), with slate-950 text on it
          "dark-hover": "#5eead4",
        },
      },
      fontFamily: {
        // Thai first-class: each platform's own Thai face, no web-font download.
        sans: ['"Segoe UI"', "Roboto", '"Noto Sans Thai"', '"Leelawadee UI"', "Thonburi", "system-ui", "sans-serif"],
      },
      borderRadius: {
        field: "12px",
        card: "16px",
      },
      minHeight: {
        tap: "44px",
      },
      minWidth: {
        tap: "44px",
      },
    },
  },
  plugins: [],
};
