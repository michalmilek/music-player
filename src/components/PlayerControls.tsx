import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Shuffle,
  ArrowRight,
} from "lucide-react";
import { PlaybackMode } from "../types/music";

interface PlayerControlsProps {
  isPlaying: boolean;
  currentSong: any | null;
  playbackMode: PlaybackMode;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSkipBackward: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onTogglePlaybackMode: () => void;
}

export function PlayerControls({
  isPlaying,
  currentSong,
  playbackMode,
  onTogglePlay,
  onPrevious,
  onNext,
  onSkipBackward,
  onSkipForward,
  onTogglePlaybackMode,
}: PlayerControlsProps) {
  const getPlaybackModeIcon = () => {
    switch (playbackMode) {
      case PlaybackMode.RepeatOne:
        return <Repeat1 className="w-5 h-5" />;
      case PlaybackMode.RepeatAll:
        return <Repeat className="w-5 h-5" />;
      case PlaybackMode.Shuffle:
        return <Shuffle className="w-5 h-5" />;
      case PlaybackMode.Linear:
      default:
        return <ArrowRight className="w-5 h-5" />;
    }
  };

  const getPlaybackModeTitle = () => {
    switch (playbackMode) {
      case PlaybackMode.RepeatOne:
        return "Repeat current song";
      case PlaybackMode.RepeatAll:
        return "Repeat playlist";
      case PlaybackMode.Shuffle:
        return "Shuffle playlist";
      case PlaybackMode.Linear:
      default:
        return "Linear playback";
    }
  };
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onTogglePlaybackMode}
        className={`p-2 rounded-md transition-colors ${
          playbackMode !== PlaybackMode.Linear 
            ? 'bg-primary/20 text-primary hover:bg-primary/30' 
            : 'hover:bg-muted'
        }`}
        title={getPlaybackModeTitle()}
      >
        {getPlaybackModeIcon()}
      </button>
      
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