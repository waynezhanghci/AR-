import React, { useRef, useEffect } from 'react';
import { Point, Particle } from '../types';

interface SparklerOverlayProps {
  targetPosition: Point | null;
  isActive: boolean;
  width: number;
  height: number;
}

const SparklerOverlay: React.FC<SparklerOverlayProps> = ({ targetPosition, isActive, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const createParticle = (x: number, y: number): Particle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1; // Random speed
      const life = Math.random() * 30 + 20; // 20-50 frames
      
      // Varied colors for realistic sparkler effect
      // 10% pure white (hot), 60% gold/yellow, 30% orange/red (cooling)
      let color;
      const rand = Math.random();
      if (rand > 0.9) {
        color = `hsl(0, 0%, 100%)`; // White hot
      } else if (rand > 0.3) {
        color = `hsl(${40 + Math.random() * 15}, 100%, ${60 + Math.random() * 30}%)`; // Yellow/Gold
      } else {
        color = `hsl(${20 + Math.random() * 20}, 100%, ${50 + Math.random() * 20}%)`; // Orange/Red
      }

      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1, // Slight upward bias initially
        life,
        maxLife: life,
        color,
        size: Math.random() * 3.5 + 0.5, // Varied sizes: 0.5 to 4.0
      };
    };

    const update = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // CRITICAL UPDATE: Removed internal Lerp (linear interpolation).
      // We now trust the parent component (App.tsx) to provide the smoothed position.
      // Double smoothing causes "drag" and makes the sparkler feel detached.
      const currentEmitPos = targetPosition;

      // Emitter logic
      if (isActive && currentEmitPos) {
        // Emit multiple particles per frame for density
        const particlesToEmit = 12; 
        for (let i = 0; i < particlesToEmit; i++) {
            // Reduced randomness from 3 to 1.5. 
            // This makes the sparks originate strictly from the tip, improving the "stuck" feeling.
            const offsetX = (Math.random() - 0.5) * 1.5;
            const offsetY = (Math.random() - 0.5) * 1.5;
            particlesRef.current.push(createParticle(currentEmitPos.x + offsetX, currentEmitPos.y + offsetY));
        }

        // Draw core glow with flicker
        const flickerScale = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
        const glowRadius = 25 * flickerScale;
        
        const gradient = ctx.createRadialGradient(currentEmitPos.x, currentEmitPos.y, 0, currentEmitPos.x, currentEmitPos.y, glowRadius);
        gradient.addColorStop(0, `rgba(255, 255, 220, ${0.7 * flickerScale})`);
        gradient.addColorStop(0.4, `rgba(255, 200, 50, ${0.3 * flickerScale})`);
        gradient.addColorStop(1, 'rgba(255, 100, 50, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(currentEmitPos.x, currentEmitPos.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update and Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        
        // Physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // Gravity
        p.vx *= 0.92; // Air resistance
        p.vy *= 0.92; 

        p.life--;

        // Remove dead particles
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        // Draw
        ctx.fillStyle = p.color;
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, isActive, targetPosition]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none z-30" // Increased Z-index to be above Snow (z-20) and Dimmer (z-10)
      style={{ filter: 'blur(0.5px)' }} // Slight blur for glowiness
    />
  );
};

export default SparklerOverlay;