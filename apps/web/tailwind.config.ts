import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#131313',
          dim: '#131313',
          bright: '#393939',
          container: {
            lowest: '#0E0E0E',
            low: '#1C1B1B',
            DEFAULT: '#201F1F',
            high: '#2A2A2A',
            highest: '#353534',
          },
        },
        primary: {
          DEFAULT: '#00D1FF',
          light: '#A4E6FF',
          container: '#004D61',
          dim: '#006C84',
        },
        secondary: {
          DEFAULT: '#FFB800',
          container: '#5C4200',
        },
        tertiary: {
          DEFAULT: '#4BF1FF',
          container: '#00D5E2',
        },
        critical: {
          DEFAULT: '#FFB4AB',
          container: '#93000A',
        },
        on: {
          surface: '#E6E1E5',
          'surface-variant': '#C4C7C5',
          primary: '#003545',
          secondary: '#3D2E00',
        },
        outline: {
          DEFAULT: '#3C494E',
          variant: 'rgba(60, 73, 78, 0.15)',
        },
      },
      fontFamily: {
        headline: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'display-md': ['3rem', { lineHeight: '1.15', fontWeight: '700' }],
        'display-sm': ['2.25rem', { lineHeight: '1.2', fontWeight: '600' }],
        'headline-lg': ['1.875rem', { lineHeight: '1.25', fontWeight: '600' }],
        'headline-md': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-sm': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.05em' }],
        'label-md': ['0.75rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.08em' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.1em' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        ambient: '0 0 40px 0 rgba(230, 225, 229, 0.06)',
        glow: '0 0 15px rgba(0, 209, 255, 0.3)',
        'glow-amber': '0 0 15px rgba(255, 184, 0, 0.3)',
        'glow-critical': '0 0 15px rgba(255, 180, 171, 0.3)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 2px #00d1ff)' },
          '50%': { opacity: '0.5', filter: 'drop-shadow(0 0 8px #00d1ff)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
