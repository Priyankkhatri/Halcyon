import React from 'react';
import { Link } from 'wouter';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export default function TrustMeter({ confidence = 0, matchCount = 0, state = 'escalated', matchedIds = [], isDetailed = false }) {
  const segmentCount = 5;
  const activeSegments = Math.round((confidence / 100) * segmentCount);
  const isLowConfidence = confidence < 65;

  // Determine colors based on state and confidence level
  const activeColorClass = state === 'memory-match' 
    ? (isLowConfidence ? 'bg-[#E8935B]' : 'bg-[#2EC4B6]') 
    : 'bg-[#E8935B]';
    
  const textColorClass = state === 'memory-match' 
    ? (isLowConfidence ? 'text-[#E8935B]' : 'text-[#2EC4B6]') 
    : 'text-text-muted';

  if (state === 'escalated') {
    return (
      <div className={`flex flex-col gap-1.5 ${isDetailed ? 'p-4 bg-background/50 border border-border-light rounded-2xl' : ''}`}>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#E8935B] font-bold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>NO MATCHING PRECEDENT</span>
        </div>
        <p className="font-sans text-[11px] leading-relaxed text-text-muted">
          Full diagnostic reasoning applied via verifier LLM pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${isDetailed ? 'p-4 bg-background/50 border border-border-light rounded-2xl w-full' : 'max-w-xs'}`}>
      {/* Segmented Bar */}
      <div className="flex items-center gap-1.5 h-1.5">
        {[...Array(segmentCount)].map((_, idx) => (
          <div
            key={idx}
            className={`h-full rounded-sm flex-1 ${
              idx < activeSegments 
                ? activeColorClass 
                : 'bg-border-light/40 dark:bg-border-light/20'
            }`}
          />
        ))}
      </div>

      {/* Description text */}
      <div className="text-[11px] text-text-muted leading-tight">
        <span className={`font-mono font-bold ${textColorClass}`}>{confidence}%</span> confidence — based on{' '}
        <span className="font-mono font-bold text-text-primary">{matchCount}</span> past{' '}
        {matchCount === 1 ? 'incident' : 'incidents'}
      </div>

      {/* Linked references for detailed view */}
      {isDetailed && matchedIds.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border-light/50 flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="text-text-muted">MATCHED IDS:</span>
          {matchedIds.map((id) => (
            <Link key={id} href={`/incident/${id}`}>
              <a className="px-2 py-0.5 rounded bg-surface border border-border-light hover:border-primary/40 text-text-primary hover:text-primary transition-all cursor-pointer">
                INC-{id.toString().padStart(4, '0')}
              </a>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
