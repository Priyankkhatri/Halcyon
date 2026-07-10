import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Waveform from './Waveform';
import { Activity, ShieldCheck, Cpu, ArrowRight, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import Card from './ui/Card';

export default function LandingPage({ onEnterApp }) {
  const [heroState, setHeroState] = useState('chaotic');
  const [statusText, setStatusText] = useState('CHAOTIC OUTAGE');
  const [activeFaq, setActiveFaq] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHeroState('calm');
      setStatusText('RESOLVED (98% MATCH)');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      icon: <Activity className="w-5 h-5 text-primary" />,
      title: "Hindsight Memory Match",
      desc: "Instantly maps incoming trace dumps to known past incident signatures, eliminating redundant on-call root-cause analysis."
    },
    {
      icon: <Cpu className="w-5 h-5 text-accent-warm" />,
      title: "cascadeflow Routing",
      desc: "Routes novel incidents through a dynamic drafter-verifier LLM pipeline, optimizing API cost by up to 80% while retaining logic quality."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-secondary" />,
      title: "Compliance-Gated Proxy",
      desc: "Automatically detects PII or sensitive keys in raw log dumps and routes the payload to locally-gated models to avoid compliance leaks."
    }
  ];

  const faqs = [
    {
      q: "How does the memory recall mechanism work?",
      a: "Halcyon indexes resolutions in Hindsight, a specialized local memory bank. When a new crash happens, we run a semantic vector query to fetch past solutions."
    },
    {
      q: "What is cascadeflow?",
      a: "cascadeflow is our model routing framework. It feeds logs to a fast, cheap model first. If it passes verification, we resolve it. If not, it escalates to a reasoning model."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-text-muted font-sans selection:bg-accent-warm/25 overflow-x-hidden relative transition-colors duration-300">
      
      {/* Decorative atmospheric mesh background (Afterlife Style) */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <motion.div 
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -40, 30, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[55vw] h-[55vw] rounded-full blur-[140px] opacity-[0.10] bg-[#8CA596]"
        />
        <motion.div 
          animate={{
            x: [0, -40, 50, 0],
            y: [0, 30, -40, 0],
            scale: [1, 0.95, 1.05, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[25%] -right-[15%] w-[50vw] h-[50vw] rounded-full blur-[160px] opacity-[0.12] bg-[#E29A76]"
        />
      </div>

      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-background/80 backdrop-blur-md z-40 border-b border-border-light/40 px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="font-serif text-2xl font-semibold tracking-tight text-text-primary">Halcyon</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <a href="#features" className="hover:text-primary transition-colors">Architecture</a>
          <a href="#before-after" className="hover:text-primary transition-colors">Before/After</a>
          <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
        </nav>

        <Button 
          onClick={onEnterApp}
          variant="primary"
        >
          Enter Dashboard &rarr;
        </Button>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 pt-40 pb-20 px-6 max-w-5xl mx-auto flex flex-col items-center text-center">
        
        {/* Dynamic Title */}
        <h1 className="text-6xl md:text-8xl font-serif text-text-primary tracking-wide mb-8 leading-tight max-w-4xl">
          Incident memory, <br className="hidden md:block" />
          <span className="italic font-normal text-primary">calmed.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-text-muted max-w-2xl font-light mb-16 leading-relaxed">
          Instantly resolve system alerts by tapping into an active, self-learning institutional memory of past fixes.
        </p>

        {/* Premium Waveform Console Interface */}
        <div className="w-full max-w-4xl bg-surface border border-border-light rounded-3xl p-6 shadow-antigravity mb-24 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-accent-warm to-secondary" />
          
          {/* Console Header Bar */}
          <div className="flex justify-between items-center text-xs font-mono border-b border-border-light pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="font-semibold text-text-primary">HALCYON CORE REAL-TIME OSCILLOSCOPE</span>
            </div>
            <div className="flex items-center gap-4 text-text-muted">
              <span>SPAN: 1200ms</span>
              <span>SAMPLING: 44.1kHz</span>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="h-48 flex items-center justify-center bg-background/50 rounded-2xl border border-border-light/80 p-4 relative overflow-hidden">
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
                  className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-widest border shadow-sm ${
                    heroState === 'chaotic' 
                      ? 'bg-primary/10 border-primary/20 text-primary' 
                      : 'bg-accent-warm/10 border-accent-warm/20 text-accent-warm'
                  }`}
                >
                  SYSTEM_STATE: {statusText}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Comparative Section */}
        <section id="before-after" className="w-full mb-32 text-left scroll-mt-24">
          <h2 className="text-4xl font-serif text-text-primary mb-4 tracking-wide text-center">
            How it works in practice
          </h2>
          <p className="text-center text-text-muted font-light mb-16 max-w-xl mx-auto">
            Witness the comparison between raw CLI chaos and Halcyon's memory-matching resolution.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            
            {/* Before: Raw Terminal logs */}
            <div className="bg-[#0D0F11] border border-border-light/20 rounded-3xl p-8 shadow-antigravity relative overflow-hidden flex flex-col h-full">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-red-400/80" />
              <div className="flex items-center justify-between border-b border-border-light/10 pb-4 mb-6">
                <span className="font-mono text-xs text-slate-400 font-medium">TERMINAL: stdin_log_pipeline</span>
                <span className="font-mono text-xs text-red-400 font-bold uppercase tracking-wider">Outage Triggered</span>
              </div>
              <pre className="font-mono text-sm leading-relaxed text-red-300/80 overflow-x-auto whitespace-pre-wrap flex-1">
                <span className="text-red-500 font-bold">[CRITICAL]</span> OutOfMemoryError in api-worker-91<br/>
                Memory cgroup limit reached: 2.0GB<br/>
                Process 89412 killed by OOM-killer<br/>
                <span className="text-slate-500 italic mt-4 block">Waiting on-call escalation to level-2 engineer...</span>
              </pre>
            </div>

            {/* After: Halcyon Resolution */}
            <Card className="border border-accent-warm/20 relative overflow-hidden flex flex-col h-full animateHover" animateHover={true}>
              <div className="absolute top-0 left-0 w-full h-[3px] bg-accent-warm" />
              <div className="flex items-center justify-between border-b border-border-light pb-4 mb-6">
                <span className="font-mono text-xs text-text-primary font-bold">HALCYON COGNITIVE RETRIEVAL</span>
                <span className="font-mono text-xs text-accent-warm font-bold uppercase tracking-wider">Auto Resolved</span>
              </div>
              
              <div className="space-y-6 flex-1">
                <div className="bg-background border border-border-light p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent-warm animate-ping" />
                  <span className="font-mono text-sm text-text-primary font-bold">100% MEMORY MATCH : INC-0042</span>
                </div>
                <p className="text-sm font-mono text-text-primary leading-relaxed bg-accent-warm/5 border border-accent-warm/15 p-4 rounded-2xl">
                  <strong>Suggested Fix:</strong> Heap size was insufficient. Increase pod limit to 4.0GB and adjust JVM heap flags.
                </p>
                <div className="text-xs font-mono font-bold text-accent-warm">DOWNTIME SAVED: 18 minutes (Escalation bypassed)</div>
              </div>
            </Card>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section id="features" className="w-full mb-32 scroll-mt-24">
          <h2 className="text-4xl font-serif text-text-primary mb-12 tracking-wide">
            Cognitive Infrastructure Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <Card key={i} className="flex flex-col text-left animateHover" animateHover={true}>
                <div className="w-10 h-10 rounded-2xl bg-background border border-border-light flex items-center justify-center mb-6 shadow-sm">
                  {f.icon}
                </div>
                <h3 className="font-serif text-2xl text-text-primary mb-3 tracking-wide">{f.title}</h3>
                <p className="text-sm text-text-muted font-light leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className="w-full max-w-3xl mb-16 scroll-mt-24 text-left">
          <h2 className="text-4xl font-serif text-text-primary mb-12 tracking-wide text-center">Frequently Answered</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div 
                  key={index} 
                  className="bg-surface rounded-2xl border border-border-light shadow-antigravity overflow-hidden transition-all duration-300"
                >
                  <button 
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full p-6 flex justify-between items-center text-left font-serif text-xl font-medium text-text-primary focus:outline-none"
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
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border-light bg-surface/50 py-16 relative z-10 text-center">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 divide-x divide-border-light">
          <div>
            <div className="text-4xl font-serif text-text-primary mb-1">98%</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">Faster Resolution</div>
          </div>
          <div>
            <div className="text-4xl font-serif text-text-primary mb-1">100x</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">Cheaper Inference</div>
          </div>
          <div>
            <div className="text-4xl font-serif text-text-primary mb-1">Zero</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">Compliance Risks</div>
          </div>
          <div>
            <div className="text-4xl font-serif text-accent-warm mb-1">Infinite</div>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider font-semibold">Institutional Memory</div>
          </div>
        </div>
        <p className="text-xs text-text-muted font-light">&copy; 2026 Halcyon. Built for the Hackathon.</p>
      </footer>
    </div>
  );
}
