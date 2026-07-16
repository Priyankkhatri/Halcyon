import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

const GithubIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    style={{ width: '1.125rem', height: '1.125rem' }}
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);
import { Sidebar } from './Sidebar';
import { FloatingDock } from './FloatingDock';
import Waveform from '../Waveform';
import logo from '../../assets/logo.png';
import { useApp } from '../../context/AppContext';

export default function AppShell({ children, systemState }) {
  const { t, language, setLanguage } = useApp();
  const [isDark, setIsDark] = useState(true);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('x-github-repo') || '');
  const [githubToken, setGithubToken] = useState(localStorage.getItem('x-github-token') || '');

  const saveGithubConfig = () => {
    localStorage.setItem('x-github-repo', githubRepo.trim());
    localStorage.setItem('x-github-token', githubToken.trim());
    setShowGithubModal(false);
    window.location.reload();
  };

  // Initialize theme from saved preference; default to dark when unset.
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  // Global mouse coordinates listener for neon cursor spotlight
  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      document.documentElement.style.setProperty('--mouse-x', `${clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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
        {/* Dynamic radial mouse-following spotlight */}
        <div 
          className="absolute inset-0 opacity-[0.06] dark:opacity-[0.12] mix-blend-screen transition-opacity duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(650px circle at var(--mouse-x, 50vw) var(--mouse-y, 40vh), rgba(46, 196, 182, 0.2), rgba(232, 147, 91, 0.05), transparent 70%)`
          }}
        />

        <motion.div 
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 20, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-sm blur-[140px] opacity-[0.04] bg-[#2EC4B6]"
        />
        <motion.div 
          animate={{
            x: [0, -20, 30, 0],
            y: [0, 30, -20, 0],
            scale: [1, 0.93, 1.07, 1],
          }}
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] -right-[15%] w-[45vw] h-[45vw] rounded-sm blur-[160px] opacity-[0.05] bg-[#E8935B]"
        />
      </div>

      {/* Left Sidebar Navigation */}
      <Sidebar />

      {/* Main Panel Content Wrapper */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden relative z-10">
        
        {/* Top Control Bar Header */}
        <header className="flex items-center justify-between w-full h-20 px-4 md:px-8 border-b border-border-light glass-panel select-none sticky top-0 z-30">
          {/* Desktop Title */}
          <div className="hidden md:block">
            <h2 className="text-xs font-mono font-bold tracking-widest text-text-primary uppercase">
              {t('dashboard.feedTitle')} - {t('dashboard.tableTitle')}
            </h2>
          </div>

          {/* Mobile Title / Logo */}
          <div className="flex items-center gap-2.5 md:hidden">
            <img src={logo} alt="Halcyon Logo" className="w-7 h-7 rounded-lg object-cover border border-border-light/40" />
            <span className="font-sans text-lg font-bold tracking-tight text-text-primary">Halcyon</span>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Saturated Telemetry Status Pill */}
            <div className="flex items-center gap-2 md:gap-3 bg-surface border border-border-light px-3 md:px-4 py-1.5 md:py-2 rounded-lg shadow-antigravity">
              <span className="font-mono text-[8px] md:text-[9px] tracking-widest font-bold text-text-muted">SYSTEM:</span>
              <div className="w-12 md:w-16 h-5 overflow-hidden flex items-center justify-center border-x border-border-light/40 px-1 md:px-2 mx-0.5 md:mx-1">
                <Waveform state={systemState} size="small" />
              </div>
              <span className={`font-mono text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${systemState === 'chaotic' ? 'text-primary animate-pulse-glow' : 'text-accent-warm'}`}>
                {systemState === 'chaotic' ? 'UNSTABLE' : 'STABLE'}
              </span>
            </div>

            {/* Language Selector */}
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="appearance-none bg-surface border border-border-light hover:border-border-strong px-3.5 py-2 pr-8 rounded-lg font-mono text-[10px] font-bold text-text-muted hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-warm/30 transition-all cursor-pointer shadow-antigravity"
                aria-label="Select language"
              >
                <option value="en">EN</option>
                <option value="hi">HI</option>
                <option value="gu">GU</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted/60 font-bold text-[8px] font-mono">&darr;</div>
            </div>

            {/* GitHub Settings button */}
            <button
              onClick={() => setShowGithubModal(true)}
              className="w-9 h-9 rounded-lg bg-surface border border-border-light hover:border-accent-warm/50 shadow-antigravity flex items-center justify-center text-text-muted hover:text-text-primary transition-all duration-200 cursor-pointer focus:outline-none focus-ring"
              aria-label="Configure GitHub Integration"
            >
              <GithubIcon className="text-primary" />
            </button>

            {/* Config button (styled like a NOC terminal toggle) */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg bg-surface border border-border-light hover:border-accent-warm/50 shadow-antigravity flex items-center justify-center text-text-muted hover:text-text-primary transition-all duration-200 cursor-pointer focus:outline-none focus-ring"
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

      {/* GitHub Integration Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative bg-surface border border-border-light rounded-xl p-6 w-full max-w-md shadow-antigravity-hover space-y-6 font-mono text-xs overflow-hidden">
            <div className="accent-strip-bar rounded-t-xl" />
            <button
              onClick={() => setShowGithubModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-xl font-bold cursor-pointer focus:outline-none"
              aria-label="Close modal"
            >
              &times;
            </button>
            
            <div className="space-y-1">
              <h3 className="font-sans text-lg text-text-primary font-bold flex items-center gap-2">
                <GithubIcon className="text-primary" style={{ width: '1.25rem', height: '1.25rem' }} />
                Connect GitHub Repository
              </h3>
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Client-side Telemetry Correlation</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Repository (owner/repo)</label>
                <input
                  type="text"
                  placeholder="e.g. sahilchaudhari32/Halcyon"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  className="w-full bg-background border border-border-light rounded-md px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Personal Access Token (PAT)</label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full bg-background border border-border-light rounded-md px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-border-light focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  localStorage.removeItem('x-github-repo');
                  localStorage.removeItem('x-github-token');
                  setGithubRepo('');
                  setGithubToken('');
                  setShowGithubModal(false);
                  window.location.reload();
                }}
                className="flex-1 py-2 px-4 rounded-md border border-border-light hover:border-red-400 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none"
              >
                Disconnect
              </button>
              <button
                onClick={saveGithubConfig}
                className="flex-1 py-2 px-4 rounded-md bg-accent-warm text-white hover:bg-accent-warm-hover shadow-glow-teal text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating navigation dock for mobile viewports */}
      <FloatingDock />
    </div>
  );
}
