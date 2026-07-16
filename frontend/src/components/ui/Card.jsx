import React from 'react';
import { motion } from 'framer-motion';

export default function Card({
  children,
  className = '',
  animateHover = true,
  accentStrip = false,
  ...props
}) {
  return (
    <motion.div
      whileHover={animateHover ? { y: -3, boxShadow: 'var(--shadow-val-antigravity-hover)' } : undefined}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`relative bg-surface rounded-xl p-6 border border-border-light shadow-antigravity transition-colors duration-200 ${className}`}
      {...props}
    >
      {accentStrip && <div className="accent-strip-bar rounded-t-xl" />}
      {children}
    </motion.div>
  );
}
