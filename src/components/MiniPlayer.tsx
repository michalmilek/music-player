import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Maximize2,
  Music
} from "lucide-react";

interface MiniPlayerProps {
  currentSong: { name: string; metadata?: { artist?: string | null } } | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolumeChange: (volume: number) => void;
  onExpand: () => void;
  onSeek: (time: number) => void;
}

export function MiniPlayer({
  currentSong,
  isPlaying,
  volume,
  currentTime,
  duration,
  onTogglePlay,
  onPrevious,
  onNext,
  onVolumeChange,
  onExpand,
  onSeek
}: MiniPlayerProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
      {/* Progress bar */}
      <div 
        className="h-1 bg-muted cursor-pointer relative group"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />
        <div 
          className="absolute top-0 h-full w-1 bg-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>

      <div className="px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Song info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
              <Music className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-sm">
                {currentSong?.name || 'No song playing'}
              </div>
              {currentSong?.metadata?.artist && (
                <div className="truncate text-xs text-muted-foreground">
                  {currentSong.metadata.artist}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPrevious}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Previous"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={onTogglePlay}
              className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onNext}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Next"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Time */}
          <div className="text-xs text-muted-foreground font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-20 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            />
          </div>

          {/* Expand button */}
          <button
            onClick={onExpand}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Expand player"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}