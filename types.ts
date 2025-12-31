export interface Point {
  x: number;
  y: number;
}

export interface RecognitionResult {
  label: string;
  confidence: number;
  top_point: Point;
  effect: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}