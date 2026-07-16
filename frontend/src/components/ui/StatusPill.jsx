import React from 'react';

export default function StatusPill({ status, confidence }) {
  const isMatch = status === 'memory-match';

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-mono font-semibold tracking-wide transition-colors ${
      isMatch
        ? 'bg-accent-warm/10 border-accent-warm/40 text-accent-warm'
        : 'bg-primary/10 border-primary/40 text-primary'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isMatch ? 'bg-accent-warm shadow-glow-teal' : 'bg-primary shadow-glow-amber animate-pulse-glow'}`} />
      {isMatch ? `KNOWN ISSUE ${confidence ? `— ${confidence}%` : ''}` : 'NOVEL INCIDENT'}
    </div>
  );
}
