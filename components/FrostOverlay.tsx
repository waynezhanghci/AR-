import React, { useRef, useEffect } from 'react';
import { Point } from '../types';

interface FrostOverlayProps {
  width: number;
  height: number;
  drawingPoint: Point | null; // The point effectively "erasing" the frost
}

const FrostOverlay: React.FC<FrostOverlayProps> = ({ width, height, drawingPoint }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Initialize Noise Texture (The grainy fog look)
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
    
    // Generate fine-grained noise
    for (let i = 0; i < data.length; i += 4) {
      // Random grey value for texture
      const val = 200 + Math.random() * 55; 
      data[i] = val;     // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 40;  // Low opacity (alpha) for the noise itself
    }
    ctx.putImageData(imgData, 0, 0);
  }, []);

  // 2. Initialize Main Canvas (Fill with fog)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !noiseCanvasRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // A. Base Fog Color (Cold, milky white/blue)
    // Using source-over to layer on top of whatever was there (or empty)
    // We clear rect first to ensure resizing works properly
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = 'rgba(230, 240, 255, 0.85)'; // High opacity base for the "steamy window" look
    ctx.fillRect(0, 0, width, height);

    // B. Apply Noise Pattern
    const pattern = ctx.createPattern(noiseCanvasRef.current, 'repeat');
    if (pattern) {
        ctx.fillStyle = pattern;
        ctx.globalCompositeOperation = 'source-over'; 
        ctx.fillRect(0, 0, width, height);
    }
    
    // C. Add a vignette for realism (corners get less foggy/more dark usually, or just style)
    const grad = ctx.createRadialGradient(width/2, height/2, height * 0.4, width/2, height/2, height);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(200,220,240,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

  }, [width, height]); // Only re-fill when size changes

  // 3. Handle Eraser / Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingPoint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use 'destination-out' to punch a hole through the white layer
    ctx.globalCompositeOperation = 'destination-out';
    
    const brushSize = 40; // Finger size
    
    // Soft brush edge
    const grad = ctx.createRadialGradient(drawingPoint.x, drawingPoint.y, brushSize * 0.2, drawingPoint.x, drawingPoint.y, brushSize);
    grad.addColorStop(0, 'rgba(0,0,0,1)');   // Full erase at center
    grad.addColorStop(0.5, 'rgba(0,0,0,0.8)'); 
    grad.addColorStop(1, 'rgba(0,0,0,0)');   // No erase at edge
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(drawingPoint.x, drawingPoint.y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    // Reset to default
    ctx.globalCompositeOperation = 'source-over';

  }, [drawingPoint]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none z-25"
      style={{ 
        // Optional: slight backdrop blur to simulate distance between glass and world
        backdropFilter: 'blur(2px)' 
      }} 
    />
  );
};

export default FrostOverlay;