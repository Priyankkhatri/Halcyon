import React from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Activity, Cpu, FileText, Shield, Settings, LogOut } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useApp } from '../../context/AppContext';

export const Sidebar = () => {
  const { t, subscription, limitCount, maxLogs } = useApp();
  const [location] = useLocation();

  const navItems = [
    { path: '/dashboard', label: t('sidebar.incFeed'), icon: Activity },
    { path: '/memory', label: t('sidebar.hindsight'), icon: Cpu },
    { path: '/audit', label: t('sidebar.audit'), icon: FileText },
    { path: '/settings', label: t('sidebar.settings') || 'Settings', icon: Settings }
  ];

  return (
    <aside className="w-64 h-screen bg-surface border-r border-border-light hidden md:flex flex-col justify-between select-none sticky top-0 z-40">
      <div className="flex-1 flex flex-col">
        {/* Sidebar Logo Branding */}
        <div className="h-20 px-6 border-b border-border-light flex items-center gap-3">
          <img src={logo} alt="Halcyon Logo" className="w-8 h-8 rounded-lg object-cover border border-border-light/40" />
          <div>
            <span className="font-sans text-xl font-bold tracking-tight text-text-primary">Halcyon</span>
            <span className="block text-[8px] font-mono text-text-muted uppercase tracking-widest -mt-0.5">NOC Intelligence</span>
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="p-4 space-y-1.5 flex-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;

            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer text-xs font-mono font-semibold tracking-wide transition-all group focus:outline-none focus:ring-1 focus:ring-accent-warm/30 ${
                  isActive
                    ? 'bg-accent-warm/10 border border-accent-warm/30 text-accent-warm shadow-[inset_0_0_18px_rgba(46,196,182,0.08)]'
                    : 'text-text-muted hover:text-text-primary hover:bg-border-light/40 border border-transparent'
                }`}
                aria-label={item.label}
              >
                <Icon className={`w-4.5 h-4.5 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-accent-warm' : 'text-text-muted group-hover:text-text-primary'}`} />
                <span>{item.label}</span>

                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveIndicator"
                    className="absolute right-3 w-1.5 h-1.5 rounded-full bg-accent-warm shadow-glow-teal"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Subscription Tier Widget */}
      <div className="mx-4 p-3 rounded-md border border-border-light bg-surface/50 font-mono text-[10px] space-y-2 mb-2">
        <div className="flex justify-between items-center">
          <span className="text-text-muted font-bold uppercase tracking-wider">{t('sidebar.subscription')}:</span>
          <span className={`font-bold tracking-widest px-1.5 py-0.5 rounded text-[8px] border uppercase ${
            subscription === 'pro' 
              ? 'bg-surface text-accent-warm border-border-light' 
              : 'bg-surface text-primary border-border-light'
          }`}>
            {subscription === 'pro' ? t('sidebar.proTier') : t('sidebar.freeTier')}
          </span>
        </div>
        
        {subscription === 'free' && (
          <div className="text-text-muted/80 leading-relaxed text-[9px]">
            {t('sidebar.limitText', { count: limitCount, max: maxLogs })}
          </div>
        )}
        
        <Link 
          href="/billing"
          className="block w-full text-center py-1.5 rounded-lg bg-background border border-border-light hover:border-border-light hover:text-text-primary transition-all text-[9px] font-bold uppercase tracking-wider mt-1 focus:outline-none cursor-pointer"
        >
          {subscription === 'pro' ? t('sidebar.billing') : t('sidebar.upgradeBtn')}
        </Link>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-border-light bg-background/20 font-mono text-[10px] space-y-3">
        <div className="flex items-center justify-between text-text-muted">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-accent-warm" />
            <span className="font-bold">{t('sidebar.complianceEngine')}</span>
          </div>
          <span className="text-accent-warm font-bold">{t('sidebar.online')}</span>
        </div>
        
        <button
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 rounded-lg border border-border-light/40 hover:border-border-light text-text-muted hover:text-red-400 font-bold transition-all uppercase tracking-wider cursor-pointer text-[9px]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>

        <div className="text-text-muted/50 text-[9px] tracking-wider leading-relaxed">
          {t('sidebar.sandboxNode')}<br/>
          {t('sidebar.apiVersion')}
        </div>
      </div>
    </aside>
  );
};
