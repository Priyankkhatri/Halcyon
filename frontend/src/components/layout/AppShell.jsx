import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Activity } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { FloatingDock } from './FloatingDock';
import Waveform from '../Waveform';
import logo from '../../assets/logo.png';

export default function AppShell({ children, systemState }) {
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from saved preference or default to light (as per request)
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <div className="relative h-screen w-full bg-background text-text-muted overflow-hidden flex font-sans antialiased transition-colors duration-300">
      
      {/* NOC Control Room Ambient Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <motion.div 
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 20, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[140px] opacity-[0.06] bg-[#2EC4B6]"
        />
        <motion.div 
          animate={{
            x: [0, -20, 30, 0],
            y: [0, 30, -20, 0],
            scale: [1, 0.93, 1.07, 1],
          }}
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] -right-[15%] w-[45vw] h-[45vw] rounded-full blur-[160px] opacity-[0.08] bg-[#E8935B]"
        />
      </div>

      {/* Left Sidebar Navigation */}
      <Sidebar />

      {/* Main Panel Content Wrapper */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden relative z-10">
        
        {/* Top Control Bar Header */}
        <header className="flex items-center justify-between w-full h-20 px-4 md:px-8 border-b border-border-light bg-surface/30 backdrop-blur-md select-none sticky top-0 z-30">
          {/* Desktop Title */}
          <div className="hidden md:block">
            <h2 className="text-xs font-mono font-bold tracking-widest text-text-primary uppercase">NOC OPERATIONAL TELEMETRY</h2>
          </div>

          {/* Mobile Title / Logo */}
          <div className="flex items-center gap-2.5 md:hidden">
            <img src={logo} alt="Halcyon Logo" className="w-7 h-7 rounded-lg object-cover border border-border-light/40" />
            <span className="font-serif text-lg font-bold tracking-tight text-text-primary">Halcyon</span>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Saturated Telemetry Status Pill */}
            <div className="flex items-center gap-2 md:gap-3 bg-surface/80 border border-border-light px-3 md:px-4 py-1.5 md:py-2 rounded-xl shadow-sm">
              <span className="font-mono text-[8px] md:text-[9px] tracking-widest font-bold text-text-muted">SYSTEM:</span>
              <div className="w-12 md:w-16 h-5 overflow-hidden flex items-center justify-center border-x border-border-light/40 px-1 md:px-2 mx-0.5 md:mx-1">
                <Waveform state={systemState} size="small" />
              </div>
              <span className={`font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${systemState === 'chaotic' ? 'text-primary animate-pulse' : 'text-accent-warm'}`}>
                {systemState === 'chaotic' ? 'UNSTABLE' : 'STABLE'}
              </span>
            </div>

            {/* Config button (styled like a NOC terminal toggle) */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-surface border border-border-light hover:border-primary/20 flex items-center justify-center text-text-muted hover:text-text-primary transition-all duration-200 cursor-pointer focus:outline-none focus-ring"
              aria-label="Toggle system mode"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-primary" />
              ) : (
                <Moon className="w-4 h-4 text-primary" />
              )}
            </button>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto pb-28 md:pb-24">
          {children}
        </main>
      </div>

      {/* Floating navigation dock for mobile viewports */}
      <FloatingDock />
    </div>
  );
}
