import { useEffect, useRef } from 'react';

const DEFAULT_AMBER = '#E8935B'; // kingfisher-amber
const DEFAULT_TEAL = '#2EC4B6';  // kingfisher-teal

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(46, 196, 182, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Waveform({ state = 'calm', size = 'small', color }) {
  const canvasRef = useRef(null);
  
  // Size mapping
  const width = size === 'large' ? 800 : size === 'medium' ? 140 : 70;
  const height = size === 'large' ? 160 : size === 'medium' ? 48 : 24;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    
    // High-DPI canvas scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    let animationFrameId;
    let time = 0;
    
    // Configuration based on size
    const baseAmpChaos = size === 'large' ? 35 : size === 'medium' ? 18 : 5;
    const baseAmpCalm = size === 'large' ? 8 : size === 'medium' ? 4 : 1.5;
    const noiseFactorChaos = size === 'large' ? 12 : size === 'medium' ? 6 : 2.5;
    const freqChaos = size === 'large' ? 0.015 : size === 'medium' ? 0.04 : 0.12;
    const freqCalm = size === 'large' ? 0.008 : size === 'medium' ? 0.02 : 0.06;
    
    // State targets
    const getTargets = (s) => {
      const isChaotic = s === 'chaotic';
      return {
        amp: isChaotic ? baseAmpChaos : baseAmpCalm,
        freq: isChaotic ? freqChaos : freqCalm,
        speed: isChaotic ? 0.08 : 0.02,
        noise: isChaotic ? noiseFactorChaos : 0,
      };
    };

    let current = getTargets(state);
    
    const render = () => {
      const target = getTargets(state);
      
      // Lerp towards targets
      const lerp = 0.025;
      current.amp += (target.amp - current.amp) * lerp;
      current.freq += (target.freq - current.freq) * lerp;
      current.speed += (target.speed - current.speed) * lerp;
      current.noise += (target.noise - current.noise) * lerp;

      if (!prefersReducedMotion) {
        time += current.speed;
      }
      
      // Determine stroke color
      let strokeColor = color;
      if (!strokeColor) {
        strokeColor = state === 'chaotic' ? DEFAULT_AMBER : DEFAULT_TEAL;
      }

      ctx.clearRect(0, 0, width, height);
      const midY = height / 2;
      
      // Draw layers of waves for a richer, premium feel
      const waves = size === 'large' ? [
        { ampMult: 1.0, freqMult: 1.0, phaseSpeed: 1.0, opacity: 0.85, width: 3 },
        { ampMult: 0.65, freqMult: 1.4, phaseSpeed: -0.7, opacity: 0.45, width: 1.8 },
        { ampMult: 0.35, freqMult: 0.7, phaseSpeed: 1.5, opacity: 0.25, width: 1.2 }
      ] : size === 'medium' ? [
        { ampMult: 1.0, freqMult: 1.0, phaseSpeed: 1.0, opacity: 0.9, width: 2.2 },
        { ampMult: 0.6, freqMult: 1.3, phaseSpeed: -0.8, opacity: 0.5, width: 1.2 },
        { ampMult: 0.3, freqMult: 0.7, phaseSpeed: 1.4, opacity: 0.3, width: 0.8 }
      ] : [
        { ampMult: 1.0, freqMult: 1.0, phaseSpeed: 1.0, opacity: 0.9, width: 1.8 },
        { ampMult: 0.6, freqMult: 1.5, phaseSpeed: -0.8, opacity: 0.4, width: 1.0 }
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.strokeStyle = hexToRgba(strokeColor, wave.opacity);
        ctx.lineWidth = wave.width;
        ctx.lineJoin = 'round';
        
        for (let x = 0; x <= width; x += 2) {
          const phase = time * wave.phaseSpeed;
          let y = midY + Math.sin(x * current.freq * wave.freqMult + phase) * current.amp * wave.ampMult;
          
          // Add pseudo-random noise layers for chaotic state
          if (current.noise > 0.5 && !prefersReducedMotion) {
              const noise1 = Math.sin(x * 0.4 + time * 2.5) * current.noise * wave.ampMult * 0.8;
              const noise2 = Math.cos(x * 0.15 - time * 3) * (current.noise * 0.4) * wave.ampMult * 0.8;
              y += noise1 + noise2;
          }
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      
      const dist = Math.abs(current.amp - target.amp) + Math.abs(current.noise - target.noise);
      if (prefersReducedMotion && dist < 0.1) {
        return;
      }
      
      if (!prefersReducedMotion || dist >= 0.1) {
        animationFrameId = requestAnimationFrame(render);
      }
    };
    
    render();
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [state, size, width, height, color]);
  
  return (
    <div style={{ width, height, overflow: 'hidden' }} className="flex items-center justify-center relative">
      {/* Soft background glow (Afterlife style) */}
      {size === 'large' && (
        <div 
          className="absolute inset-0 w-full h-full blur-[80px] opacity-10 rounded-full transition-colors duration-500 pointer-events-none"
          style={{ backgroundColor: state === 'chaotic' ? DEFAULT_AMBER : DEFAULT_TEAL }}
        />
      )}
      <canvas 
        ref={canvasRef} 
        style={{ width: `${width}px`, height: `${height}px`, display: 'block', zIndex: 1 }} 
      />
    </div>
  );
}
