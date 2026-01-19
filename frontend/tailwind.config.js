/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a', // deeply dark blue/slate
        surface: '#1e293b',    // lighter slate for cards
        primary: '#38bdf8',    // sky blue
        accent: '#2dd4bf',     // teal
      },
      fontFamily: {
        sans: ['Inter', 'Nunito', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      }
    },
  },
  plugins: [],
}
