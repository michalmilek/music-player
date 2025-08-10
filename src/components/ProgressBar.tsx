import { useState, useEffect, useRef } from "react";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function ProgressBar({ 
  currentTime: propCurrentTime, 
  duration, 
  onSeek
}: ProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Use prop time when not dragging, drag time when dragging
  const displayTime = isDragging ? dragTime : propCurrentTime;

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
    onSeek(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    setIsDragging(true);
    const newTime = calculateTimeFromEvent(e);
    setDragTime(newTime);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressRef.current) return;
      const newTime = calculateTimeFromEvent(e);
      setDragTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onSeek(dragTime);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragTime, onSeek]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-12 text-right">
        {formatTime(displayTime)}
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
            width: `${duration > 0 ? (displayTime / duration) * 100 : 0}%`,
            transition: isDragging ? 'none' : 'width 100ms ease'
          }}
        />
      </div>
      <span className="text-sm text-muted-foreground w-12">
        {formatTime(duration)}
      </span>
    </div>
  );
}