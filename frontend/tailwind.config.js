/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader', 'Cormorant Garamond', 'Georgia', 'serif'],
        display: ['Cinzel', 'Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"Space Mono"', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        board: {
          bg: "#11100e",
          surface: "#181715",
          raised: "#22201d",
          recessed: "#0c0b0a",
          border: "#2b2824",
          crease: "#3a3630",
        },
        paper: {
          white: "#f5f2eb",
          ecru: "#e8e1d5",
          parchment: "#d4caba",
          sand: "#a39886",
          charcoal: "#5c5448",
          ink: "#181614",
        },
        foil: {
          gold: "#c99a5b",
          copper: "#b87333",
          silver: "#b0b7c0",
        },
        signal: {
          emerald: "#2eb872",
          amber: "#d99b26",
          crimson: "#cf4338",
          cobalt: "#3a7bd5",
        },
        brand: {
          green: "#2eb872",
          yellow: "#d99b26",
          red: "#cf4338",
          dark: "#11100e",
        },
      },
    },
  },
  plugins: [],
}

