/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#1a1d22',
          panel: '#22262c',
          border: '#353a42',
          accent: '#2d8f6b',
          accentHover: '#34a67a',
          muted: '#8b929c',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
