import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
} from "lucide-react";

interface PlayerControlsProps {
  isPlaying: boolean;
  currentSong: any | null;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSkipBackward: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
}

export function PlayerControls({
  isPlaying,
  currentSong,
  onTogglePlay,
  onPrevious,
  onNext,
  onSkipBackward,
  onSkipForward,
}: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrevious}
        className="p-2 rounded-md hover:bg-muted transition-colors"
        title="Previous song"
      >
        <SkipBack className="w-5 h-5" />
      </button>
      <button
        onClick={() => onSkipBackward(10)}
        disabled={!currentSong}
        className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Skip backward 10s"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
      <button
        onClick={onTogglePlay}
        className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6" />
        )}
      </button>
      <button
        onClick={() => onSkipForward(10)}
        disabled={!currentSong}
        className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Skip forward 10s"
      >
        <RotateCw className="w-5 h-5" />
      </button>
      <button
        onClick={onNext}
        className="p-2 rounded-md hover:bg-muted transition-colors"
        title="Next song"
      >
        <SkipForward className="w-5 h-5" />
      </button>
    </div>
  );
}