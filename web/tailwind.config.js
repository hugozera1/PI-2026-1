/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        card: 'rgba(20, 26, 40, 0.7)',
        cardBorder: 'rgba(255, 255, 255, 0.1)',
        primary: '#6366f1', // Indigo
        accentA: '#3b82f6', // Blue
        accentB: '#8b5cf6', // Violet
      }
    },
  },
  plugins: [],
}
