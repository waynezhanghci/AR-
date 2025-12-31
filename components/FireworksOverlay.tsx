import React, { useRef, useEffect } from 'react';
import { Point } from '../types';

interface FireworksOverlayProps {
  targetPosition: Point | null;
  isActive: boolean;
  width: number;
  height: number;
}

// Helper to represent RGB
interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  history: Point[]; // For trails
  life: number;
  maxLife: number;
  size: number;
  layer: 'core' | 'mid' | 'outer';
  palette: { core: ColorRGB; mid: ColorRGB; outer: ColorRGB };
}

// Reference Palette (Purple + Blue + Gold) as described
const PALETTES = [
  { 
    core: { r: 157, g: 0, b: 255 },    // #9D00FF (Deep Purple)
    mid: { r: 123, g: 131, b: 255 },   // #7B83FF (Light Blue/Purple)
    outer: { r: 255, g: 215, b: 0 }    // #FFD700 (Gold)
  },
  {
     core: { r: 255, g: 0, b: 100 },   // Deep Pink
     mid: { r: 0, g: 255, b: 255 },    // Cyan
     outer: { r: 255, g: 255, b: 255 } // White
  },
  {
     core: { r: 0, g: 50, b: 255 },    // Deep Blue
     mid: { r: 0, g: 255, b: 100 },    // Lime
     outer: { r: 255, g: 200, b: 100 } // Orange/Gold
  }
];

const FireworksOverlay: React.FC<FireworksOverlayProps> = ({ targetPosition, isActive, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<FireworkParticle[]>([]);
  const lastEmitPosRef = useRef<Point | null>(null);
  const animationFrameRef = useRef<number>();
  const frameCountRef = useRef<number>(0);
  
  // Keep latest props in refs to avoid restarting the effect loop
  const targetPosRef = useRef(targetPosition);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    targetPosRef.current = targetPosition;
    isActiveRef.current = isActive;
  }, [targetPosition, isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper to blend colors based on life progress
    const getColor = (p: FireworkParticle, progress: number): string => {
      let c1: ColorRGB, c2: ColorRGB, ratio: number;
      
      // Interpolate: Core -> Mid -> Outer based on life
      // progress 1.0 = fresh (Core), 0.0 = dead (Outer)
      if (progress > 0.6) {
        c1 = p.palette.mid;
        c2 = p.palette.core;
        ratio = (progress - 0.6) / 0.4;
      } else {
        c1 = p.palette.outer;
        c2 = p.palette.mid;
        ratio = progress / 0.6;
      }
      
      // Clamp ratio to 0-1 just in case
      ratio = Math.max(0, Math.min(1, ratio));
      
      const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
      const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
      const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
      
      return `rgb(${r}, ${g}, ${b})`; 
    };

    const createGroup = (origin: Point) => {
      const groupSize = 18; 
      const selectedPalette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      
      for (let i = 0; i < groupSize; i++) {
        const rand = Math.random();
        let layer: 'core' | 'mid' | 'outer';
        let speed: number;
        let size: number;
        let life: number;

        if (rand < 0.2) {
          layer = 'core';
          speed = 5 + Math.random() * 3;
          size = 1 + Math.random();
          life = 30 + Math.random() * 20;
        } else if (rand < 0.6) {
          layer = 'mid';
          speed = 8 + Math.random() * 4;
          size = 2 + Math.random() * 2;
          life = 40 + Math.random() * 30;
        } else {
          layer = 'outer';
          speed = 12 + Math.random() * 6;
          size = 3 + Math.random() * 2;
          life = 50 + Math.random() * 30; 
        }

        const angle = Math.random() * Math.PI * 2;
        
        particlesRef.current.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          history: [],
          life,
          maxLife: life,
          size,
          layer,
          palette: selectedPalette
        });
      }
    };

    const update = () => {
      frameCountRef.current++;

      // Clear with 'destination-out' to create a fade trail effect if desired, 
      // but sticking to clearRect for performance as requested.
      ctx.clearRect(0, 0, width, height);
      
      ctx.globalCompositeOperation = 'screen'; 

      const currentTarget = targetPosRef.current;
      const currentActive = isActiveRef.current;

      // 2. GENERATION
      if (currentActive && currentTarget) {
        let emitPos = currentTarget;
        if (lastEmitPosRef.current) {
             const dx = currentTarget.x - lastEmitPosRef.current.x;
             const dy = currentTarget.y - lastEmitPosRef.current.y;
             emitPos = {
                 x: lastEmitPosRef.current.x + dx * 0.5,
                 y: lastEmitPosRef.current.y + dy * 0.5
             };
        }
        lastEmitPosRef.current = emitPos;

        if (frameCountRef.current % 4 === 0) {
            createGroup(emitPos);
            
            // Draw Center Glow
            try {
                const glowRadius = 25;
                // Safety check for valid coordinates
                if (isFinite(emitPos.x) && isFinite(emitPos.y)) {
                    const glowGrad = ctx.createRadialGradient(emitPos.x, emitPos.y, 0, emitPos.x, emitPos.y, glowRadius);
                    glowGrad.addColorStop(0, 'rgba(157, 0, 255, 0.5)'); 
                    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = glowGrad;
                    ctx.beginPath();
                    ctx.arc(emitPos.x, emitPos.y, glowRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            } catch (e) {
                // Ignore gradient errors
            }
        }
      } else {
        lastEmitPosRef.current = null;
      }

      // 3. UPDATE & DRAW
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        
        // --- PHYSICS ---
        p.history.push({ x: p.x, y: p.y });
        
        if (p.history.length > 8) {
            p.history.shift();
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.layer === 'mid') {
            p.vy += 0.15; 
        } else if (p.layer === 'outer') {
            p.vx *= 0.92; 
            p.vy *= 0.92;
            p.vy += 0.1; 
        }
        
        p.life--;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        // --- DRAWING ---
        const progress = p.life / p.maxLife;
        const colorString = getColor(p, progress);
        const alpha = Math.max(progress, 0.1);

        // 1. Draw Trail (Simple Path)
        if (p.history.length > 1) {
            ctx.beginPath();
            // Ensure history point exists
            const start = p.history[0];
            if (start) {
                ctx.moveTo(start.x, start.y);
                for (let j = 1; j < p.history.length; j++) {
                    const pt = p.history[j];
                    if (pt) ctx.lineTo(pt.x, pt.y);
                }
                ctx.lineTo(p.x, p.y);
                
                ctx.strokeStyle = colorString;
                ctx.globalAlpha = 0.3 * alpha; 
                ctx.lineWidth = p.size;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        // 2. Draw Head + Fake Glow
        ctx.fillStyle = colorString;
        ctx.globalAlpha = 0.2 * alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  // IMPORTANT: Depend only on width/height. 
  // targetPosition and isActive are handled via refs to avoid restarting the loop.
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none z-30" 
    />
  );
};

export default FireworksOverlay;