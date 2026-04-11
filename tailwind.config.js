/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#0D0D0D',
        'brand-card': '#1A1A1A',
        'brand-border': '#2A2A2A',
        'brand-orange': '#E85000',
        'brand-red': '#CC1100',
        'brand-text': '#FFFFFF',
        'brand-muted': '#AAAAAA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
