import { useState, useEffect, useRef } from "react";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
}

export function ProgressBar({ 
  currentTime: initialTime, 
  duration, 
  onSeek,
  isPlaying 
}: ProgressBarProps) {
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTime(initialTime);
  }, [initialTime]);

  useEffect(() => {
    if (!isPlaying || isDragging) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 0.1;
        return duration > 0 ? Math.min(newTime, duration) : newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, duration, isDragging]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateTimeFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!progressRef.current) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    return percentage * duration;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0 || isDragging) return;
    const newTime = calculateTimeFromEvent(e);
    setCurrentTime(newTime);
    onSeek(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    setIsDragging(true);
    const newTime = calculateTimeFromEvent(e);
    setCurrentTime(newTime);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressRef.current) return;
      const newTime = calculateTimeFromEvent(e);
      setCurrentTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onSeek(currentTime);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, currentTime, onSeek]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-12 text-right">
        {formatTime(currentTime)}
      </span>
      <div 
        ref={progressRef}
        className="flex-1 h-2 bg-muted rounded-lg relative cursor-pointer" 
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        <div
          className="h-full bg-primary rounded-lg transition-all duration-100"
          style={{ 
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            transition: isDragging ? 'none' : 'all 100ms'
          }}
        />
      </div>
      <span className="text-sm text-muted-foreground w-12">
        {formatTime(duration)}
      </span>
    </div>
  );
}