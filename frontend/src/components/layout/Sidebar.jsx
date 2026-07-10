import React from 'react';
import { Link, useRoute } from 'wouter';
import { motion } from 'framer-motion';
import { Activity, Cpu, FileText, Shield } from 'lucide-react';

export const Sidebar = () => {
  const navItems = [
    { path: '/', label: 'Incident Feed', icon: Activity },
    { path: '/memory', label: 'Hindsight Memory', icon: Cpu },
    { path: '/audit', label: 'Audit Trail', icon: FileText }
  ];

  return (
    <aside className="w-64 h-screen bg-surface border-r border-border-light flex flex-col justify-between select-none sticky top-0 z-40">
      <div className="flex-1 flex flex-col">
        {/* Sidebar Logo Branding */}
        <div className="h-20 px-6 border-b border-border-light flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-text-primary">Halcyon</span>
            <div className="text-[9px] font-mono font-bold tracking-widest text-primary/80 uppercase">NOC CONTROL PANEL</div>
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="p-4 space-y-1.5 flex-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const [isActive] = useRoute(item.path);

            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={`relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-xs font-mono font-semibold tracking-wide transition-all group focus:outline-none focus:ring-1 focus:ring-primary/20 ${
                    isActive 
                      ? 'bg-accent-warm/10 border-l-2 border-accent-warm text-accent-warm shadow-sm' 
                      : 'text-text-muted hover:text-text-primary hover:bg-background/50 border-l-2 border-transparent'
                  }`}
                  aria-label={item.label}
                >
                  <Icon className={`w-4.5 h-4.5 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-accent-warm' : 'text-text-muted group-hover:text-text-primary'}`} />
                  <span>{item.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="sidebarActiveIndicator"
                      className="absolute right-3 w-1.5 h-1.5 rounded-full bg-accent-warm"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </a>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-border-light bg-background/20 font-mono text-[10px] space-y-3">
        <div className="flex items-center gap-2 text-text-muted">
          <Shield className="w-3.5 h-3.5 text-accent-warm" />
          <span className="font-bold">COMPLIANCE ENGINE:</span>
          <span className="text-accent-warm font-bold">ONLINE</span>
        </div>
        <div className="text-text-muted/50 text-[9px] tracking-wider leading-relaxed">
          SECURE SANDBOX NODE #8491<br/>
          API VERSION: v1.0.4-PROD
        </div>
      </div>
    </aside>
  );
};
