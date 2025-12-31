/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // Rabby-style dark theme
        'bg-primary': '#1a1a1a',
        'bg-secondary': '#242424',
        'bg-tertiary': '#2a2a2a',
        'bg-hover': '#333333',
        'border-primary': '#3a3a3a',
        'border-secondary': '#444444',
        'text-primary': '#ffffff',
        'text-secondary': '#a0a0a0',
        'text-tertiary': '#666666',
        'accent-blue': '#7b61ff',
        'accent-blue-hover': '#6b51ef',
        'accent-green': '#2ed573',
        'accent-red': '#ff4757',
        'accent-yellow': '#ffa502',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
