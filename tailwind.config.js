/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
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
      keyframes: {
        'ai-pulse': {
          '0%, 90%, 100%': { boxShadow: '0 0 0 0 rgba(13,86,17,0)' },
          '92%': { boxShadow: '0 0 0 0 rgba(13,86,17,0.5)' },
          '96%': { boxShadow: '0 0 0 12px rgba(13,86,17,0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'ai-pulse': 'ai-pulse 5s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
