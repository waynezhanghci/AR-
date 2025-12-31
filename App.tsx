import React, { useEffect, useRef, useState, useCallback } from 'react';
import SnowOverlay from './components/SnowOverlay';
import FrostOverlay from './components/FrostOverlay';
import { Point } from './types';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // This canvas holds the raw video frame
  
  // Toggles
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [isSnowing, setIsSnowing] = useState(false);
  const [isFrosty, setIsFrosty] = useState(false);
  
  // Interaction State (Drawing on Frost)
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoint, setDrawingPoint] = useState<Point | null>(null);

  // Motion State
  const [motionScore, setMotionScore] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  // Internal Refs
  const processingRef = useRef(false);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer back camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setHasPermission(false);
      }
    };

    startCamera();
  }, []);

  // Frame Analysis Loop (Only for Motion Detection -> Snow Effect)
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processingRef.current) return;

    processingRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video is ready
    if (video.readyState !== 4) {
        processingRef.current = false;
        return;
    }

    // Draw video frame to canvas
    const scale = 0.25; 
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // --- Motion Detection Logic (Used for shaking off snow) ---
      try {
        const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = currentFrame.data;
        let diffSum = 0;
        
        // Compare with previous frame
        if (prevFrameDataRef.current && prevFrameDataRef.current.length === data.length) {
          // Skip pixels for performance
          for (let i = 0; i < data.length; i += 32) {
            const diff = Math.abs(data[i] - prevFrameDataRef.current[i]);
            diffSum += diff;
          }
          
          const pixelCount = data.length / 32;
          const avgDiff = diffSum / pixelCount;
          const score = Math.min(avgDiff / 30, 1.0); 
          setMotionScore(score);
        }
        
        prevFrameDataRef.current = new Uint8ClampedArray(data);
      } catch (e) {
        console.warn("Motion detection skipped", e);
      }
      // ------------------------------
    }
    
    processingRef.current = false;
    requestAnimationFrame(captureAndAnalyze);
  }, []);

  // Start Loop
  useEffect(() => {
    const timer = setTimeout(() => {
        captureAndAnalyze();
    }, 1000);
    return () => clearTimeout(timer);
  }, [captureAndAnalyze]);

  // --- Interaction Handlers (For Frost Drawing) ---
  const handleStart = (clientX: number, clientY: number) => {
    if (!isFrosty) return;
    setIsDrawing(true);
    setDrawingPoint({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isFrosty || !isDrawing) return;
    setDrawingPoint({ x: clientX, y: clientY });
  };

  const handleEnd = () => {
    setIsDrawing(false);
    setDrawingPoint(null);
  };

  return (
    <div 
      className="relative w-screen h-screen bg-black overflow-hidden select-none"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
    >
      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video Feed (Z-0) */}
      {hasPermission !== false ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-white">
          Camera permission required.
        </div>
      )}

      {/* Dimming Layer (Z-10) */}
      <div 
        className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-700 ease-in-out z-10 ${
          isLightsOff ? 'opacity-80' : 'opacity-0'
        }`} 
      />

      {/* Snow Overlay (Z-20) */}
      <SnowOverlay 
         isActive={isSnowing}
         width={window.innerWidth}
         height={window.innerHeight}
         motionScore={motionScore}
      />

      {/* Frost Overlay (Z-25) - Rendered conditionally for performance, but we keep it mounted if active to retain the drawing */}
      {isFrosty && (
        <FrostOverlay 
          width={window.innerWidth} 
          height={window.innerHeight} 
          drawingPoint={drawingPoint}
        />
      )}
      
      {/* UI Layer (Z-30) */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-4 pointer-events-auto">
        {/* Lights Toggle */}
        <button
          onClick={() => setIsLightsOff(!isLightsOff)}
          className="bg-black/40 backdrop-blur-md text-white border border-white/20 rounded-full p-3 shadow-lg hover:bg-black/60 transition-all active:scale-95"
          aria-label="Toggle Lights"
        >
          {isLightsOff ? (
            <span className="text-xl">💡</span>
          ) : (
            <span className="text-xl">🌑</span>
          )}
        </button>
        
        {/* Snow Toggle */}
        <button
          onClick={() => setIsSnowing(!isSnowing)}
          className={`bg-black/40 backdrop-blur-md text-white border border-white/20 rounded-full p-3 shadow-lg hover:bg-black/60 transition-all active:scale-95 ${isSnowing ? 'bg-blue-500/30 border-blue-400' : ''}`}
          aria-label="Toggle Snow"
        >
          <span className="text-xl">❄️</span>
        </button>

        {/* Frost Toggle */}
        <button
          onClick={() => {
              setIsFrosty(!isFrosty);
              setDrawingPoint(null); // Reset drawing cursor
          }}
          className={`bg-black/40 backdrop-blur-md text-white border border-white/20 rounded-full p-3 shadow-lg hover:bg-black/60 transition-all active:scale-95 ${isFrosty ? 'bg-cyan-100/30 border-cyan-200' : ''}`}
          aria-label="Toggle Frost"
        >
          <span className="text-xl">🌫️</span>
        </button>
      </div>
      
      {/* Decorative Overlay Vignette - Always on top */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-t from-black/40 via-transparent to-black/40"></div>
    </div>
  );
};

export default App;