/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#eef4fb',
          100: '#d7e5f5',
          200: '#b5cce8',
          300: '#86abd6',
          400: '#5686c0',
          500: '#3568a4',
          600: '#1f4f86',
          700: '#1a426f',
          800: '#16365c',
          900: '#122c4b',
          950: '#0c1f36',
        },
        blue: {
          50: '#eef4fb',
          100: '#d7e5f5',
          200: '#b5cce8',
          300: '#86abd6',
          400: '#5686c0',
          500: '#3568a4',
          600: '#1f4f86',
          700: '#1a426f',
          800: '#16365c',
          900: '#122c4b',
          950: '#0c1f36',
        },
      },
    },
  },
  plugins: [],
}

