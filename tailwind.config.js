/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2F5E3E',
        'primary-hover': '#254a31',
        'surface-light': '#FFFFFF',
        'surface-dark': '#1F2937',
        'background-light': '#F3F4F6',
        'background-dark': '#111827',
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
