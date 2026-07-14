/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        primary: {
          DEFAULT: '#FF6B6B', // vibrant neon coral/red
          hover: '#FF4757'
        },
        secondary: {
          DEFAULT: '#4DABF7', // bright blue
          hover: '#339AF0'
        },
        'accent-warm': {
          DEFAULT: '#20C997', // neon mint/teal
          hover: '#12B886'
        },
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        'border-light': 'var(--border-light)'
      },
      fontFamily: {
        serif: ["Instrument Serif", "Georgia", "serif"],
        sans: ["Plus Jakarta Sans", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["Outfit", "sans-serif"]
      },
      boxShadow: {
        antigravity: 'var(--shadow-val-antigravity)',
        'antigravity-hover': 'var(--shadow-val-antigravity-hover)',
        'neon-primary': '0 0 15px rgba(255, 107, 107, 0.4), 0 0 30px rgba(255, 107, 107, 0.2)',
        'neon-accent': '0 0 15px rgba(32, 201, 151, 0.4), 0 0 30px rgba(32, 201, 151, 0.2)'
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%)',
      }
    },
  },
  plugins: [],
}
