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
    'inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold rounded-full focus-ring transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variants = {
    primary:
      'bg-gradient-to-r from-[#8CA596] to-[#7A9384] hover:from-[#7A9384] hover:to-[#7A9384] text-white shadow-antigravity hover:shadow-antigravity-hover active:scale-[0.98]',
    secondary:
      'bg-accent-warm/5 hover:bg-accent-warm/10 text-accent-warm border border-accent-warm/10 hover:border-accent-warm/20 active:scale-[0.98]',
    outline:
      'bg-white dark:bg-surface border border-border-light hover:border-primary/20 text-text-primary hover:text-primary active:scale-[0.98]',
    text: 'text-text-muted hover:text-text-primary hover:bg-background/50 px-3.5 py-2',
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
