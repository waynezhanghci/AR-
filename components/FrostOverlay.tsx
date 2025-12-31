import React, { useRef, useEffect } from 'react';
import { Point } from '../types';

interface FrostOverlayProps {
  width: number;
  height: number;
  drawingPoint: Point | null; // The point effectively "erasing" the frost
  resetKey?: number; // Prop to trigger reset
}

interface Drip {
  x: number;
  y: number;
  vx: number; // Small horizontal wiggle
  vy: number; // Gravity
  size: number;
  life: number;
}

const FrostOverlay: React.FC<FrostOverlayProps> = ({ width, height, drawingPoint, resetKey }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // State refs
  const dripsRef = useRef<Drip[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  const animationFrameRef = useRef<number>();

  // 1. Initialize Noise Texture (The grainy fog look) - Only once
  useEffect(() => {
    if (!noiseCanvasRef.current) {
      noiseCanvasRef.current = document.createElement('canvas');
    }
    const noiseCanvas = noiseCanvasRef.current;
    noiseCanvas.width = 256;
    noiseCanvas.height = 256;
    const ctx = noiseCanvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const val = 200 + Math.random() * 55; 
      data[i] = val;     // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 40;  // Alpha
    }
    ctx.putImageData(imgData, 0, 0);
  }, []);

  // 2. Initialize Mask Canvas (Stores the "erased" path) & Handle Reset
  useEffect(() => {
    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement('canvas');
    }
    const maskCanvas = maskCanvasRef.current;
    // Resize mask but TRY to preserve content if possible, or just clear implies reset
    // For simplicity in this interaction, resizing clears the fog (new window size = new fog)
    maskCanvas.width = width;
    maskCanvas.height = height;
    
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
        // Clear mask initially (black transparent)
        ctx.clearRect(0, 0, width, height);
    }
    // Clear drips on resize or reset
    dripsRef.current = [];
    lastPointRef.current = null;
  }, [width, height, resetKey]); // Added resetKey dependency

  // 3. Main Animation Loop (Compositing & Physics)
  useEffect(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const noiseCanvas = noiseCanvasRef.current;
    if (!canvas || !maskCanvas || !noiseCanvas) return;
    
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    const render = () => {
      // A. Update Drips (Physics on the Mask)
      if (dripsRef.current.length > 0) {
        maskCtx.fillStyle = 'rgba(0,0,0,0.8)'; // Semi-transparent eraser for drips
        
        for (let i = dripsRef.current.length - 1; i >= 0; i--) {
          const drip = dripsRef.current[i];
          
          // Move
          drip.x += drip.vx;
          drip.y += drip.vy;
          
          // Random wiggle
          if (Math.random() < 0.1) drip.vx = (Math.random() - 0.5) * 0.5;
          
          // Draw Drip Trail on Mask
          maskCtx.beginPath();
          maskCtx.arc(drip.x, drip.y, drip.size, 0, Math.PI * 2);
          maskCtx.fill();

          drip.life--;
          
          // Remove if dead or off screen
          if (drip.life <= 0 || drip.y > height) {
            dripsRef.current.splice(i, 1);
          }
        }
      }

      // B. Render Main Scene
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Base Fog
      ctx.fillStyle = 'rgba(230, 240, 255, 0.85)';
      ctx.fillRect(0, 0, width, height);

      // 2. Apply Noise
      const pattern = ctx.createPattern(noiseCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.globalCompositeOperation = 'source-over'; 
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Vignette
      const grad = ctx.createRadialGradient(width/2, height/2, height * 0.4, width/2, height/2, height);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(200,220,240,0.3)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 4. Cut out the Mask (The Drawing + Drips)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvas, 0, 0);

      // Reset
      ctx.globalCompositeOperation = 'source-over';

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [width, height]);

  // 4. Handle Input Logic (Drawing onto the Mask)
  useEffect(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    // Use a fixed brush size from previous request
    const brushSize = 12;

    if (drawingPoint) {
      // --- SMOOTH STROKE LOGIC ---
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize * 2; // Line width is diameter
      ctx.fillStyle = 'rgba(0,0,0,1)'; // Opaque on mask = fully erased on main
      ctx.strokeStyle = 'rgba(0,0,0,1)';

      ctx.beginPath();
      if (lastPointRef.current) {
        // Connect previous point to current
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(drawingPoint.x, drawingPoint.y);
        ctx.stroke();
      } else {
        // Start of a stroke (dot)
        ctx.arc(drawingPoint.x, drawingPoint.y, brushSize, 0, Math.PI * 2);
        ctx.fill();
      }

      lastPointRef.current = drawingPoint;

    } else {
      // Stroke Ended
      if (lastPointRef.current) {
        // Add "melting" effect at the end of the stroke
        // Increased probability to 0.4 (40%) to ensure it is visible
        if (Math.random() < 0.4) {
            const endX = lastPointRef.current.x;
            const endY = lastPointRef.current.y;
            
            dripsRef.current.push({
                x: endX + (Math.random() - 0.5) * brushSize,
                y: endY,
                vx: 0,
                vy: 0.5 + Math.random() * 1.5, 
                size: 1.0 + Math.random() * 1.5, // Small drops for "weak" effect
                life: 20 + Math.random() * 30 // Short duration
            });
        }
      }
      lastPointRef.current = null;
    }

  }, [drawingPoint]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none z-25"
      style={{ backdropFilter: 'blur(2.4px)' }} 
    />
  );
};

export default FrostOverlay;