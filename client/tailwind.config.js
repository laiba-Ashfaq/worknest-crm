/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whitepace: {
          navy: '#043873',
          navyDark: '#02244c',
          blue: '#4F9CF9',
          blueHover: '#3888ea',
          lightBlue: '#E8F2FF',
          yellow: '#FFE492',
          yellowLight: '#FFF8E1',
          bg: '#F5F7FA',
          surface: '#FFFFFF',
          text: '#212529',
          muted: '#6C757D',
          border: '#E2E8F0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
