import React from 'react';
import { Link } from 'wouter';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const segmentVariants = {
    hidden: { scaleX: 0, opacity: 0.2 },
    visible: {
      scaleX: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        damping: 18,
        stiffness: 140
      }
    }
  };

  if (state === 'escalated') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`flex flex-col gap-1.5 ${isDetailed ? 'p-4 bg-background/50 border border-border-light rounded-2xl' : ''}`}
      >
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#E8935B] font-bold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>NO KNOWN SOLUTION</span>
        </div>
        <p className="font-sans text-[11px] leading-relaxed text-text-muted">
          Automated Root Cause Analysis (RCA) performed for this novel failure.
        </p>
      </motion.div>
    );
  }

  const glowColor = state === 'memory-match' && !isLowConfidence
    ? 'rgba(46, 196, 182, 0.45)'
    : 'rgba(232, 147, 91, 0.45)';

  return (
    <div className={`flex flex-col gap-2 ${isDetailed ? 'p-4 bg-background/50 border border-border-light rounded-2xl w-full' : 'max-w-xs'}`}>
      
      {/* Staggered Animated Segmented Bar */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex items-center gap-1.5 h-1.5"
      >
        {[...Array(segmentCount)].map((_, idx) => {
          const isActive = idx < activeSegments;
          return (
            <motion.div
              key={idx}
              variants={segmentVariants}
              className={`h-full rounded-sm flex-1 origin-left ${
                isActive 
                  ? activeColorClass 
                  : 'bg-border-light/40 dark:bg-border-light/20'
              }`}
              style={{
                boxShadow: isActive ? `0 0 6px ${glowColor}` : 'none'
              }}
            />
          );
        })}
      </motion.div>

      {/* Description text */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="text-[11px] text-text-muted leading-tight"
      >
        <span className={`font-mono font-bold ${textColorClass}`}>{confidence}%</span> confidence — based on{' '}
        <span className="font-mono font-bold text-text-primary">{matchCount}</span> past{' '}
        {matchCount === 1 ? 'incident' : 'incidents'}
      </motion.div>

      {/* Linked references for detailed view */}
      {isDetailed && matchedIds.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="mt-2 pt-2 border-t border-border-light/50 flex flex-wrap items-center gap-2 text-[10px] font-mono"
        >
          <span className="text-text-muted">MATCHED IDS:</span>
          {matchedIds.map((id) => (
            <Link 
              key={id} 
              href={`/incident/${id}`}
              className="px-2 py-0.5 rounded bg-surface border border-border-light hover:border-primary/40 text-text-primary hover:text-primary transition-all cursor-pointer"
            >
              INC-{id.toString().padStart(4, '0')}
            </Link>
          ))}
        </motion.div>
      )}
    </div>
  );
}
