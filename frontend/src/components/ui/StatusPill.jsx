import React from 'react';

export default function StatusPill({ status, confidence }) {
  const isMatch = status === 'memory-match';
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium tracking-wide transition-colors ${
      isMatch 
        ? 'bg-accent-warm/10 border-accent-warm/20 text-accent-warm' 
        : 'bg-primary/10 border-primary/20 text-primary'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isMatch ? 'bg-accent-warm' : 'bg-primary'}`} />
      {isMatch ? `KNOWN ISSUE ${confidence ? `— ${confidence}%` : ''}` : 'NOVEL INCIDENT'}
    </div>
  );
}
