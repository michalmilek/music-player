import { Settings, RotateCcw, RotateCw } from "lucide-react";

interface SkipControlsProps {
  skipAmount: number;
  currentSong: any | null;
  onSkipAmountChange: (amount: number) => void;
  onSkipBackward: (seconds: number) => void;
  onSkipForward: (seconds: number) => void;
}

export function SkipControls({
  skipAmount,
  currentSong,
  onSkipAmountChange,
  onSkipBackward,
  onSkipForward,
}: SkipControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <Settings className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Skip:</span>
      <button
        onClick={() => onSkipBackward(skipAmount)}
        disabled={!currentSong}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={`Skip backward ${skipAmount}s`}
      >
        <RotateCcw className="w-3 h-3" />
        -{skipAmount}s
      </button>
      <input
        type="number"
        min="1"
        max="60"
        value={skipAmount}
        onChange={(e) => onSkipAmountChange(Math.max(1, Math.min(60, Number(e.target.value))))}
        className="w-12 px-1 py-1 text-xs text-center bg-muted rounded border-0 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        onClick={() => onSkipForward(skipAmount)}
        disabled={!currentSong}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={`Skip forward ${skipAmount}s`}
      >
        +{skipAmount}s
        <RotateCw className="w-3 h-3" />
      </button>
    </div>
  );
}