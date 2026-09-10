/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ssn: {
          blue: "#0B3C5D",
          gold: "#D9B310",
          accent: "#1D2731",
          light: "#328CC1"
        }
      }
    },
  },
  plugins: [],
}
