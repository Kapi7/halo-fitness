/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'halo-pink': '#cf448f',
        'halo-pink-dark': '#ad1457',
      },
    },
  },
  plugins: [],
}
