/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4A90A4',
          50: '#E8F4F7',
          100: '#D1E9ED',
          200: '#A3D3DB',
          300: '#75BDC9',
          400: '#4A90A4',
          500: '#3F7A8C',
          600: '#356574',
          700: '#2A4F5C',
          800: '#1F3A44',
          900: '#14242C'
        },
        secondary: {
          DEFAULT: '#9DC3E6',
          50: '#F0F7FE',
          100: '#E1EFFD',
          200: '#C3DFFB',
          300: '#9DC3E6',
          400: '#7AA7D1',
          500: '#578ABC',
          600: '#456E97',
          700: '#345272',
          800: '#22364D',
          900: '#111A28'
        },
        accent: {
          DEFAULT: '#D8B980',
          50: '#FBF8F0',
          100: '#F7F1E1',
          200: '#EFE3C3',
          300: '#E7D5A5',
          400: '#D8B980',
          500: '#CA9D5B',
          600: '#BC8136',
          700: '#8F6229',
          800: '#62431C',
          900: '#35240F'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-inset': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
};