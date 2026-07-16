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
        'surface-raised': 'var(--surface-raised)',
        // Kingfisher NOC palette — semantic class names kept stable across the app.
        // primary     = amber → unstable / alert / attention (matches Waveform chaotic)
        // accent-warm = teal  → stable / resolved / brand glow (matches Waveform calm)
        primary: {
          DEFAULT: '#E8935B', // kingfisher amber
          hover: '#DC7F42'
        },
        secondary: {
          DEFAULT: '#5B8DEF', // muted slate-blue (info / tertiary)
          hover: '#4174E0'
        },
        'accent-warm': {
          DEFAULT: '#2EC4B6', // kingfisher teal
          hover: '#22A99C'
        },
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        'border-light': 'var(--border-light)',
        'border-strong': 'var(--border-strong)'
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
        'glow-teal': '0 0 0 1px rgba(46, 196, 182, 0.25), 0 0 18px rgba(46, 196, 182, 0.35), 0 0 40px rgba(46, 196, 182, 0.15)',
        'glow-amber': '0 0 0 1px rgba(232, 147, 91, 0.25), 0 0 18px rgba(232, 147, 91, 0.35), 0 0 40px rgba(232, 147, 91, 0.15)',
        'neon-primary': '0 0 15px rgba(232, 147, 91, 0.4), 0 0 30px rgba(232, 147, 91, 0.2)',
        'neon-accent': '0 0 15px rgba(46, 196, 182, 0.4), 0 0 30px rgba(46, 196, 182, 0.2)'
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%)',
        // Reusable brand accent bar (teal → amber) for the top strips across cards/panels.
        'accent-strip': 'linear-gradient(90deg, #2EC4B6 0%, #5B8DEF 50%, #E8935B 100%)',
        'accent-strip-warm': 'linear-gradient(90deg, #E8935B 0%, #2EC4B6 100%)'
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' }
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' }
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}
