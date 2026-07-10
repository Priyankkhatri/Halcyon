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
          DEFAULT: '#E8935B', // kingfisher-amber
          hover: '#D7824A'
        },
        secondary: {
          DEFAULT: '#A6B4C4',
          hover: '#95A3B3'
        },
        'accent-warm': {
          DEFAULT: '#2EC4B6', // kingfisher-teal
          hover: '#1FB3A5'
        },
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        'border-light': 'var(--border-light)'
      },
      fontFamily: {
        serif: ["Space Grotesk", "sans-serif"], // Map font-serif to Space Grotesk for headings
        sans: ["Inter", "Geist", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["Space Grotesk", "sans-serif"]
      },
      boxShadow: {
        antigravity: 'var(--shadow-val-antigravity)',
        'antigravity-hover': 'var(--shadow-val-antigravity-hover)'
      }
    },
  },
  plugins: [],
}
