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
  // Removed accumulatedCanvasRef as we now render the profile dynamically
  const particlesRef = useRef<SnowParticle[]>([]);
  const heightMapRef = useRef<Float32Array | null>(null);
  const animationFrameRef = useRef<number>();

  // Initialize height map
  useEffect(() => {
    // Reset height map on resize
    heightMapRef.current = new Float32Array(width).fill(0);
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
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.8 + Math.random() * 1.5, // Fall speed
        size: Math.random() * 2 + 1.5,
        alpha: 0.6 + Math.random() * 0.4
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
      const hMap = heightMapRef.current;

      if (hMap) {
         // --- 1. PHYSICS: COMPACTION & MELTING ---
         // Slowly reduce height over time (simulation of snow compacting or melting)
         // This prevents infinite growth and feels more organic
         // Only apply if there is actually snow
         for (let i = 0; i < width; i+=4) { // Optimization: strided access
            if (hMap[i] > 0.1) {
                hMap[i] -= 0.02; // Very slow decay
                if (hMap[i] < 0) hMap[i] = 0;
            }
         }

         // --- 2. PHYSICS: SMOOTHING (AVALANCHE EFFECT) ---
         // Increased passes for smoother, more liquid-like snow distribution
         const threshold = 1.0; 
         const settleAmount = 0.4;
         const passes = 3; // More passes = smoother slopes

         for(let pass=0; pass<passes; pass++) {
            // Left to Right
            for (let i = 1; i < width - 1; i++) {
                const me = hMap[i];
                const right = hMap[i+1];
                if (me > right + threshold) {
                    hMap[i] -= settleAmount;
                    hMap[i+1] += settleAmount;
                }
            }
            // Right to Left
            for (let i = width - 2; i > 0; i--) {
                const me = hMap[i];
                const left = hMap[i-1];
                if (me > left + threshold) {
                    hMap[i] -= settleAmount;
                    hMap[i-1] += settleAmount;
                }
            }
         }

         // --- 3. CHECK OVERFLOW ---
         // Check if any pile has reached the top (with a buffer)
         // Optimization: Check every 20th pixel
         for(let i=0; i<width; i+=20) {
              if(hMap[i] >= height - 10) {
                  shouldClearPile = true;
                  break;
              }
         }

         // --- 4. RENDER ACCUMULATED SNOW (THE SMOOTH GROUND) ---
         // Instead of drawing circles, we draw a filled path representing the terrain.
         ctx.beginPath();
         ctx.moveTo(0, height); // Bottom Left

         // Draw the profile
         // Step by 2 or 3 pixels to reduce draw calls, visually identical
         for (let x = 0; x < width; x+=2) {
             const h = hMap[x];
             if (h > 0.5) {
                ctx.lineTo(x, height - h);
             } else {
                ctx.lineTo(x, height);
             }
         }
         
         ctx.lineTo(width, height); // Bottom Right
         ctx.closePath();

         // Gradient Fill for Volume (White top -> Blueish bottom)
         const snowGradient = ctx.createLinearGradient(0, height - 150, 0, height);
         snowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
         snowGradient.addColorStop(1, 'rgba(220, 235, 255, 1)'); // Icy blue at bottom

         ctx.fillStyle = snowGradient;
         ctx.fill();
         
         // Optional: Top highlight line for extra crispness
        //  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        //  ctx.lineWidth = 1;
        //  ctx.stroke();
      }

      // --- 5. SHAKE / CLEAR LOGIC ---
      if (motionScore > 0.3 || shouldClearPile) {
        if (hMap) {
            hMap.fill(0);
        }
      }

      // If not active, stop generating new particles but keep rendering the pile
      if (!isActive && particlesRef.current.length === 0) {
        animationFrameRef.current = requestAnimationFrame(update);
        return;
      }

      // Replenish active particles
      if (isActive && particlesRef.current.length < 400) {
        particlesRef.current.push(createParticle(width, height));
      }

      // --- 6. UPDATE & DRAW FALLING PARTICLES ---
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.x += Math.sin(p.y * 0.02) * 0.5; // Sine wave drift

        // Wrap around screen horizontally
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        // --- COLLISION ---
        const pX = Math.floor(p.x);
        
        if (hMap && pX >= 0 && pX < width) {
            const pileHeight = hMap[pX];
            const groundY = height - pileHeight;

            // Collision with snowbank
            // Note: slightly deeper penetration (groundY + 2) looks better as it blends in
            if (p.y >= groundY + 2) {
                // ADD TO HEIGHT MAP
                // WIDER DISTRIBUTION for flatter, smoother piles
                const radius = 8; 
                for (let k = -radius; k <= radius; k++) {
                    const nx = pX + k;
                    if (nx >= 0 && nx < width) {
                        // Gaussian-ish distribution
                        const dist = Math.abs(k);
                        const falloff = Math.exp(- (dist * dist) / (2 * (radius/2) * (radius/2)));
                        
                        // Add height: p.size contributes to volume
                        hMap[nx] += (p.size * 0.5 * falloff); 
                    }
                }

                // Recycle
                Object.assign(p, createParticle(width, height));
                continue; 
            }
        }

        // Failsafe bottom
        if (p.y > height) {
           Object.assign(p, createParticle(width, height));
        }

        // Draw Falling Particle
        // Only draw if above the snowbank (simple z-index check)
        const currentGroundH = (hMap && hMap[pX]) ? hMap[pX] : 0;
        if (p.y < height - currentGroundH) {
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`; 
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
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
      className="absolute top-0 left-0 pointer-events-none z-20"
      style={{ filter: 'blur(0.5px)' }} // Slight blur for softness
    />
  );
};

export default SnowOverlay;