import React from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Activity, Cpu, Settings, GitCommit } from 'lucide-react';

export const FloatingDock = () => {
  const [location] = useLocation();
  const navItems = [
    { path: '/dashboard', label: 'Incident Feed', icon: Activity },
    { path: '/memory', label: 'Knowledge Base', icon: Cpu },
    { path: '/audit', label: 'Audit Trail', icon: GitCommit },
    { path: '/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <div className="flex items-center gap-6 px-6 py-3 rounded-2xl glass-panel shadow-antigravity-hover">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <Link 
              key={item.path} 
              href={item.path}
              className="relative flex flex-col items-center justify-center p-2 rounded-sm cursor-pointer transition-colors focus:outline-none focus-ring"
              aria-label={item.label}
            >
              <motion.div
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                className={`transition-colors duration-200 ${
                  isActive ? 'text-accent-warm' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
              </motion.div>

              {isActive && (
                <>
                  {/* Liquid Glass capsule sliding backdrop */}
                  <motion.div
                    layoutId="activeBackdrop"
                    className="absolute inset-0 bg-accent-warm/10 border border-accent-warm/30 rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 220, damping: 25 }}
                  />
                  {/* Sliding dot indicator */}
                  <motion.div
                    layoutId="activeDot"
                    className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-accent-warm shadow-glow-teal"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
