import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export function AudioVisualizer({ isPlaying, currentTime, duration }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = 64;
    const barWidth = canvas.width / bars;
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      ctx.fillStyle = 'rgba(20, 20, 20, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!isPlaying) {
        for (let i = 0; i < bars; i++) {
          const x = i * barWidth;
          const height = 10;
          
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
          gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0.3)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x + 2, canvas.height - height, barWidth - 4, height);
        }
        return;
      }

      const time = Date.now() / 100;
      const progress = duration > 0 ? currentTime / duration : 0;

      for (let i = 0; i < bars; i++) {
        const x = i * barWidth;
        
        const frequency = 0.1 + (i / bars) * 0.9;
        const amplitude = Math.sin(time * frequency + i * 0.5) * 0.3 + 
                         Math.sin(time * frequency * 2 + i) * 0.2 +
                         Math.sin(time * frequency * 0.5) * 0.1;
        
        const progressMultiplier = 0.3 + (Math.sin(progress * Math.PI * 4 + i * 0.2) * 0.5 + 0.5) * 0.7;
        const baseHeight = 20 + Math.abs(amplitude) * 100;
        const height = baseHeight * progressMultiplier;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - height);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(0.5, '#8b5cf6');
        gradient.addColorStop(1, '#ec4899');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 2, canvas.height - height, barWidth - 4, height);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentTime, duration]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={640}
        height={200}
        className="w-full h-full rounded-lg"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}