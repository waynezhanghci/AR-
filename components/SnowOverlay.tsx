import React, { useRef, useEffect } from 'react';

interface SnowParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

interface SnowOverlayProps {
  isActive: boolean;
  width: number;
  height: number;
  motionScore: number; // 0 to 1, indicates how much the user is moving
}

const SnowOverlay: React.FC<SnowOverlayProps> = ({ isActive, width, height, motionScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accumulatedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<SnowParticle[]>([]);
  const heightMapRef = useRef<Float32Array | null>(null);
  const animationFrameRef = useRef<number>();

  // Initialize off-screen canvas and height map
  useEffect(() => {
    if (!accumulatedCanvasRef.current) {
      accumulatedCanvasRef.current = document.createElement('canvas');
    }
    accumulatedCanvasRef.current.width = width;
    accumulatedCanvasRef.current.height = height;

    // Reset height map
    heightMapRef.current = new Float32Array(width).fill(0);
    
    // Clear accumulation on resize
    const ctx = accumulatedCanvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, width, height);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper to create a snowflake
    const createParticle = (w: number, h: number, startY = -10): SnowParticle => {
      return {
        x: Math.random() * w,
        y: startY,
        vx: (Math.random() - 0.5) * 0.5, // Reduced wind speed slightly
        vy: 0.4 + Math.random() * 1.2, // Significantly slower fall speed (was 1 + rand*2.5)
        size: Math.random() * 2 + 1.5,
        alpha: 0.8 + Math.random() * 0.2 // Brighter alpha for visibility against dark bg
      };
    };

    // Initialize falling particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 300; i++) {
        particlesRef.current.push(createParticle(width, height, Math.random() * height));
      }
    }

    const update = () => {
      ctx.clearRect(0, 0, width, height);
      let shouldClearPile = false;

      // --- CHECK OVERFLOW LOGIC ---
      // Check if any pile has reached the top (with a buffer)
      if (heightMapRef.current) {
          // Optimization: Check every 10th pixel to save CPU
          for(let i=0; i<width; i+=10) {
              if(heightMapRef.current[i] >= height - 20) {
                  shouldClearPile = true;
                  break;
              }
          }
      }

      // --- SHAKE / CLEAR LOGIC ---
      // If motion score is high (user shaking) OR pile hit top
      if (motionScore > 0.3 || shouldClearPile) {
        if (accumulatedCanvasRef.current) {
            const accCtx = accumulatedCanvasRef.current.getContext('2d');
            accCtx?.clearRect(0, 0, width, height);
        }
        if (heightMapRef.current) {
            heightMapRef.current.fill(0);
        }
      }

      // 1. Draw Accumulated Snow (Background Layer)
      if (accumulatedCanvasRef.current) {
        ctx.drawImage(accumulatedCanvasRef.current, 0, 0);
      }

      if (!isActive) {
        particlesRef.current = [];
        animationFrameRef.current = requestAnimationFrame(update);
        return;
      }

      // Replenish active particles
      if (particlesRef.current.length < 400) {
        particlesRef.current.push(createParticle(width, height));
      }

      const accCtx = accumulatedCanvasRef.current?.getContext('2d');
      const hMap = heightMapRef.current;

      // 2. Update & Draw Falling Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.x += Math.sin(p.y * 0.02) * 0.5; // Sine wave drift

        // Wrap around screen horizontally
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        // --- COLLISION & ACCUMULATION ---
        const pX = Math.floor(p.x);
        
        // Check if particle hits the "ground" (defined by heightMap)
        if (hMap && pX >= 0 && pX < width) {
            const pileHeight = hMap[pX];
            const groundY = height - pileHeight;

            // If particle touches the pile
            if (p.y >= groundY - p.size) {
                // Draw to static canvas (freeze it)
                if (accCtx) {
                    accCtx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`; // Pure white
                    accCtx.beginPath();
                    accCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    accCtx.fill();
                }

                // Update Height Map (Pile up)
                const radius = 2; // neighbor radius
                for (let k = -radius; k <= radius; k++) {
                    const nx = pX + k;
                    if (nx >= 0 && nx < width) {
                        hMap[nx] += (p.size * 0.5); 
                    }
                }

                // Recycle this particle to the top
                Object.assign(p, createParticle(width, height));
                continue; 
            }
        }

        // Failsafe for bottom of screen
        if (p.y > height) {
           Object.assign(p, createParticle(width, height));
        }

        // Draw Active Particle
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`; // Pure White
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
  }, [isActive, width, height, motionScore]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none z-20" // Higher than Dimmer (z-10)
    />
  );
};

export default SnowOverlay;