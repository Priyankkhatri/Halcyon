import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Waveform from './Waveform';
import { Activity, ShieldCheck, Cpu } from 'lucide-react';
import { Button } from './ui/Button';
import Card from './ui/Card';
import logo from '../assets/logo.png';
import { useApp } from '../context/AppContext';

export default function LandingPage({ onEnterApp }) {
  const { t, language, setLanguage } = useApp();
  const [heroState, setHeroState] = useState('chaotic');
  const [statusText, setStatusText] = useState('');
  const [activeFaq, setActiveFaq] = useState(null);

  // Mouse-tracking cursor coordinates for ambient neon spotlight
  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      document.documentElement.style.setProperty('--mouse-x', `${clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (heroState === 'chaotic') {
      setStatusText(t('landing.stateChaotic'));
    } else {
      setStatusText(t('landing.stateResolved'));
    }
  }, [heroState, language, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHeroState('calm');
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      icon: <Activity className="w-5 h-5 text-primary" />,
      title: t('sidebar.hindsight'),
      desc: t('landing.faq1A')
    },
    {
      icon: <Cpu className="w-5 h-5 text-accent-warm" />,
      title: "cascadeflow Routing",
      desc: t('landing.faq2A')
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-secondary" />,
      title: t('incident.complianceHeader'),
      desc: t('billing.featuresPro.2')
    }
  ];

  const faqs = [
    {
      q: t('landing.faq1Q'),
      a: t('landing.faq1A')
    },
    {
      q: t('landing.faq2Q'),
      a: t('landing.faq2A')
    }
  ];

  // Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 22,
        stiffness: 90
      }
    }
  };

  const featureContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.05
      }
    }
  };

  const fadeInUpVariants = {
    hidden: { opacity: 0, y: 35 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 70
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-muted font-sans selection:bg-surface overflow-x-hidden relative transition-colors duration-300">
      
      {/* Interactive mouse spotlight glow & decorative mesh background (Afterlife Style) */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        {/* Dynamic radial mouse-following spotlight */}
        <div 
          className="absolute inset-0 opacity-[0.16] dark:opacity-[0.24] mix-blend-screen transition-opacity duration-700"
          style={{
            background: `radial-gradient(650px circle at var(--mouse-x, 50vw) var(--mouse-y, 40vh), rgba(46, 196, 182, 0.2), rgba(232, 147, 91, 0.05), transparent 70%)`
          }}
        />
        
        {/* Ambient drift meshes */}
        <motion.div 
          animate={{
            x: [0, 40, -25, 0],
            y: [0, -35, 25, 0],
            scale: [1, 1.08, 0.92, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[55vw] h-[55vw] rounded-sm blur-[140px] opacity-[0.08] bg-[#8CA596]"
        />
        <motion.div 
          animate={{
            x: [0, -35, 40, 0],
            y: [0, 25, -35, 0],
            scale: [1, 0.94, 1.06, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[25%] -right-[15%] w-[50vw] h-[50vw] rounded-sm blur-[160px] opacity-[0.10] bg-[#E29A76]"
        />
      </div>

      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 h-20 glass-panel z-40 border-b border-border-light/40 px-4 sm:px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <div className="absolute inset-0 bg-accent-warm/30 blur-md rounded-lg group-hover:bg-accent-warm/50 transition-colors duration-500" />
            <img src={logo} alt="Halcyon Logo" className="relative w-8 h-8 rounded-lg object-cover border border-border-light/40 shadow-antigravity" />
          </div>
          <span className="font-sans text-xl sm:text-2xl font-semibold tracking-tight text-text-primary group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-accent-warm group-hover:to-primary transition-all duration-300">Halcyon</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
          <a href="#features" className="hover:text-primary transition-all duration-200">{t('nav.architecture')}</a>
          <a href="#before-after" className="hover:text-primary transition-all duration-200">{t('nav.beforeAfter')}</a>
          <a href="#faq" className="hover:text-primary transition-all duration-200">{t('nav.faq')}</a>
        </nav>

        <div className="flex items-center gap-3">
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

          <Button
            onClick={onEnterApp}
            variant="accent"
            className="px-3 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-xs"
          >
            {t('nav.enterDashboard')} &rarr;
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 pt-32 sm:pt-40 pb-20 px-4 sm:px-6 max-w-5xl mx-auto flex flex-col items-center text-center">
        
        {/* Dynamic Title with Word-by-Word Stagger Reveal */}
        <motion.h1 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-4xl sm:text-6xl md:text-8xl font-sans text-transparent bg-clip-text bg-gradient-to-r from-text-primary via-text-primary to-text-muted tracking-wide mb-6 sm:mb-8 leading-tight max-w-4xl"
        >
          {t('landing.titlePrefix').split(' ').map((word, idx) => (
            <motion.span key={idx} variants={wordVariants} className="inline-block mr-3 sm:mr-4">
              {word}
            </motion.span>
          ))}
          <br className="hidden sm:block" />
          <motion.span 
            variants={wordVariants}
            className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-warm inline-block drop-shadow-none"
          >
            {t('landing.titleSuffix')}
          </motion.span>
        </motion.h1>
        
        {/* Subtitle Reveal */}
        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          className="text-base sm:text-lg md:text-xl text-text-muted max-w-2xl font-light mb-12 sm:mb-16 leading-relaxed"
        >
          {t('landing.subtitle')}
        </motion.p>

        {/* Premium Waveform Console Interface */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1.0, type: "spring", damping: 25 }}
          className="w-full max-w-4xl bg-surface border border-border-light rounded-2xl p-4 sm:p-6 shadow-antigravity-hover mb-16 sm:mb-24 relative overflow-hidden group"
        >
          <div className="accent-strip-bar" />
          
          {/* Console Header Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-mono border-b border-border-light pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-warm shadow-glow-teal animate-pulse-glow" />
              <span className="font-semibold text-text-primary">{t('landing.coreOscilloscope')}</span>
            </div>
            <div className="flex items-center gap-4 text-text-muted self-end sm:self-auto text-[10px] sm:text-xs">
              <span>{t('landing.span')}</span>
              <span>{t('landing.sampling')}</span>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="h-48 flex items-center justify-center bg-background/50 rounded-md border border-border-light/80 p-4 relative overflow-hidden">
            <Waveform state={heroState} size="large" />

            {/* Overlay Grid lines for diagnostic scanner look */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />
            
            {/* Status indicator badge */}
            <div className="absolute bottom-4 left-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={statusText}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                  className={`px-3 py-1.5 rounded-sm text-[10px] font-mono font-bold tracking-widest border shadow-none ${
                    heroState === 'chaotic' 
                      ? 'bg-surface border-border-light text-primary' 
                      : 'bg-surface border-border-light text-accent-warm'
                  }`}
                >
                  {statusText}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Comparative Section */}
        <motion.section 
          id="before-after" 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-120px" }}
          variants={featureContainerVariants}
          className="w-full mb-20 sm:mb-32 text-left scroll-mt-24"
        >
          <motion.h2 variants={fadeInUpVariants} className="text-3xl sm:text-4xl font-sans text-text-primary mb-4 tracking-wide text-center">
            {t('landing.howItWorksTitle')}
          </motion.h2>
          <motion.p variants={fadeInUpVariants} className="text-center text-text-muted font-light mb-16 max-w-xl mx-auto">
            {t('landing.howItWorksSub')}
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            
            {/* Before: Raw Terminal logs */}
            <motion.div 
              variants={fadeInUpVariants}
              className="bg-[#0D0F11] border border-border-light/20 rounded-md sm:rounded-md p-5 sm:p-8 shadow-none relative overflow-hidden flex flex-col h-full"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-red-400/80" />
              <div className="flex items-center justify-between border-b border-border-light/10 pb-4 mb-6">
                <span className="font-mono text-xs text-slate-400 font-medium">{t('landing.terminalTitle')}</span>
                <span className="font-mono text-xs text-red-400 font-bold uppercase tracking-wider">{t('landing.outageTriggered')}</span>
              </div>
              <pre className="font-mono text-sm leading-relaxed text-red-300/80 overflow-x-auto whitespace-pre-wrap flex-1">
                <span className="text-red-500 font-bold">[CRITICAL]</span> OutOfMemoryError in api-worker-91<br/>
                Memory cgroup limit reached: 2.0GB<br/>
                Process 89412 killed by OOM-killer<br/>
                <span className="text-slate-500 italic mt-4 block">{t('landing.waitingEscalation')}</span>
              </pre>
            </motion.div>

            {/* After: Halcyon Resolution */}
            <motion.div variants={fadeInUpVariants} className="h-full">
              <Card className="border border-border-light relative overflow-hidden flex flex-col h-full animateHover" animateHover={false}>
                <div className="absolute top-0 left-0 w-full h-[3px] bg-accent-warm" />
                <div className="flex items-center justify-between border-b border-border-light pb-4 mb-6">
                  <span className="font-mono text-xs text-text-primary font-bold">{t('landing.halcyonRetrieval')}</span>
                  <span className="font-mono text-xs text-accent-warm font-bold uppercase tracking-wider">{t('landing.autoResolved')}</span>
                </div>
                
                <div className="space-y-6 flex-1">
                  <div className="bg-background border border-border-light p-4 rounded-md flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent-warm shadow-glow-teal animate-pulse-glow" />
                    <span className="font-mono text-sm text-text-primary font-bold">{t('landing.memoryMatch')}</span>
                  </div>
                  <p className="text-sm font-mono text-text-primary leading-relaxed bg-surface border border-border-light p-4 rounded-md">
                    <strong>Suggested Fix:</strong> {t('landing.suggestedFix')}
                  </p>
                  <div className="text-xs font-mono font-bold text-accent-warm">{t('landing.downtimeSaved')}</div>
                </div>
              </Card>
            </motion.div>
          </div>
        </motion.section>

        {/* Feature Cards Grid */}
        <motion.section 
          id="features" 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-120px" }}
          variants={featureContainerVariants}
          className="w-full mb-20 sm:mb-32 scroll-mt-24"
        >
          <motion.h2 variants={fadeInUpVariants} className="text-3xl sm:text-4xl font-sans text-text-primary mb-8 sm:mb-12 tracking-wide">
            {t('landing.archTitle')}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeInUpVariants} className="h-full">
                <Card className="flex flex-col text-left h-full animateHover" animateHover={false}>
                  <div className="w-12 h-12 rounded-xl bg-background border border-border-light flex items-center justify-center mb-6 shadow-antigravity group-hover:border-accent-warm/40 transition-colors">
                    {f.icon}
                  </div>
                  <h3 className="font-sans text-2xl text-text-primary mb-3 tracking-tight">{f.title}</h3>
                  <p className="text-sm text-text-muted font-light leading-relaxed">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* FAQ Accordion */}
        <motion.section 
          id="faq" 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-120px" }}
          variants={featureContainerVariants}
          className="w-full max-w-3xl mb-16 scroll-mt-24 text-left"
        >
          <motion.h2 variants={fadeInUpVariants} className="text-3xl sm:text-4xl font-sans text-text-primary mb-8 sm:mb-12 tracking-wide text-center">
            {t('landing.faqTitle')}
          </motion.h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <motion.div 
                  key={index} 
                  variants={fadeInUpVariants}
                  className="bg-surface rounded-xl border border-border-light shadow-antigravity overflow-hidden transition-all duration-300"
                >
                  <button 
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full p-5 sm:p-6 flex justify-between items-center text-left font-sans text-lg sm:text-xl font-medium text-text-primary focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    <span className="text-text-muted text-sm font-semibold">{isOpen ? '−' : '+'}</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 text-sm text-text-muted font-light leading-relaxed border-t border-border-light/50 pt-4">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border-light bg-surface/50 py-12 sm:py-16 relative z-10 text-center">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 md:divide-x divide-border-light">
          <div>
            <div className="text-4xl font-sans text-text-primary mb-1">98%</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">{t('landing.fasterResolution')}</div>
          </div>
          <div>
            <div className="text-4xl font-sans text-text-primary mb-1">100x</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">{t('landing.cheaperInference')}</div>
          </div>
          <div>
            <div className="text-4xl font-sans text-text-primary mb-1">Zero</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">{t('landing.complianceRisks')}</div>
          </div>
          <div>
            <div className="text-4xl font-sans text-accent-warm mb-1">Infinite</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">{t('landing.instMemory')}</div>
          </div>
        </div>
        <p className="text-xs text-text-muted font-light">&copy; 2026 Halcyon. {t('landing.builtForHackathon')}</p>
      </footer>
    </div>
  );
}
