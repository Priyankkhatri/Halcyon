import React from 'react';
import { motion } from 'framer-motion';

export const Button = ({
  children,
  className = '',
  variant = 'primary',
  disabled = false,
  ...props
}) => {
  const baseStyle =
    'inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold rounded-lg focus-ring transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variants = {
    // High-contrast ink button (default CTA)
    primary:
      'bg-text-primary text-background hover:opacity-90 shadow-antigravity active:scale-[0.98]',
    // Brand teal button with a soft glow — for the most important actions
    accent:
      'bg-accent-warm text-white hover:bg-accent-warm-hover shadow-glow-teal active:scale-[0.98]',
    secondary:
      'bg-surface text-text-primary border border-border-light hover:border-border-strong hover:bg-border-light/40 shadow-antigravity active:scale-[0.98]',
    outline:
      'bg-transparent border border-border-light hover:border-border-strong hover:bg-border-light/40 text-text-primary active:scale-[0.98]',
    text: 'text-text-muted hover:text-text-primary hover:bg-border-light/30 px-3.5 py-2',
  };

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
};
