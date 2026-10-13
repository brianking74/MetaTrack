/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.tsx',
    './services/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf8f4',
          100: '#f9eee3',
          200: '#f1d6be',
          300: '#e5b68f',
          400: '#d58f5c',
          500: '#c87a41',
          600: '#a76d3a',
          700: '#8b5830',
          800: '#71482a',
          900: '#5c3b25',
          950: '#4a2f1e',
        },
      },
    },
  },
  plugins: [],
};
