/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // macOS-inspired colors
        'mac-bg': {
          light: '#f5f5f7',
          dark: '#1d1d1f',
        },
        'mac-surface': {
          light: '#ffffff',
          dark: '#2d2d2f',
        },
        'mac-border': {
          light: '#d2d2d7',
          dark: '#424245',
        },
        'mac-text': {
          primary: { light: '#1d1d1f', dark: '#f5f5f7' },
          secondary: { light: '#6e6e73', dark: '#a1a1a6' },
        },
        'mac-accent': {
          blue: '#0071e3',
          green: '#34c759',
          red: '#ff3b30',
          orange: '#ff9500',
          purple: '#af52de',
          pink: '#ff2d55',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'mac': '10px',
        'mac-lg': '14px',
      },
      boxShadow: {
        'mac': '0 0 0 0.5px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1)',
        'mac-lg': '0 0 0 0.5px rgba(0,0,0,0.1), 0 4px 24px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
};
