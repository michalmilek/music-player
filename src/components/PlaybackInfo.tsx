import { Song, PlayHistoryEntry } from "../types/music";
import { Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AudioVisualizer } from "./AudioVisualizer";
import { Equalizer } from "./Equalizer";

interface PlaybackInfoProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  equalizerEnabled: boolean;
  playHistory: PlayHistoryEntry[];
  onEqualizerToggle: (enabled: boolean) => void;
  onClearHistory: () => void;
  onPlayHistorySong: (song: Song) => void;
}

export function PlaybackInfo({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  equalizerEnabled,
  playHistory,
  onEqualizerToggle,
  onClearHistory,
  onPlayHistorySong,
}: PlaybackInfoProps) {
  return (
    <Tabs defaultValue={currentSong ? "visualizer" : "history"} className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="visualizer" disabled={!currentSong}>Visualizer</TabsTrigger>
        <TabsTrigger value="equalizer">Equalizer</TabsTrigger>
        <TabsTrigger value="metadata" disabled={!currentSong}>Metadata</TabsTrigger>
        <TabsTrigger value="technical" disabled={!currentSong}>Technical Info</TabsTrigger>
        <TabsTrigger value="history">Play History</TabsTrigger>
      </TabsList>

      {currentSong && (
        <>
          <TabsContent value="visualizer" className="mt-6">
            <div className="w-full h-64 bg-black rounded-lg overflow-hidden">
              <AudioVisualizer 
                isPlaying={isPlaying} 
                currentTime={currentTime}
                duration={duration}
              />
            </div>
          </TabsContent>

          <TabsContent value="metadata" className="mt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-muted-foreground">Title:</span>
                  <p className="mt-1">{currentSong.metadata?.title || 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Artist:</span>
                  <p className="mt-1">{currentSong.metadata?.artist || 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Album:</span>
                  <p className="mt-1">{currentSong.metadata?.album || 'Unknown'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-muted-foreground">Track Number:</span>
                  <p className="mt-1">{currentSong.metadata?.track_number || 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Year:</span>
                  <p className="mt-1">{currentSong.metadata?.year || 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Genre:</span>
                  <p className="mt-1">{currentSong.metadata?.genre || 'Unknown'}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="technical" className="mt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-muted-foreground">Codec:</span>
                  <p className="mt-1">{currentSong.metadata?.codec || 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Sample Rate:</span>
                  <p className="mt-1">{currentSong.metadata?.sample_rate ? `${currentSong.metadata.sample_rate} Hz` : 'Unknown'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-muted-foreground">Channels:</span>
                  <p className="mt-1">{currentSong.metadata?.channels || 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Bits per Sample:</span>
                  <p className="mt-1">{currentSong.metadata?.bits_per_sample || 'Unknown'}</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </>
      )}

      <TabsContent value="equalizer" className="mt-6">
        <Equalizer 
          isEnabled={equalizerEnabled} 
          onToggle={onEqualizerToggle}
        />
      </TabsContent>

      <TabsContent value="history" className="mt-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="text-lg font-semibold">Play History</h3>
          <button
            onClick={onClearHistory}
            disabled={playHistory.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {playHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No songs played yet</p>
          ) : (
            playHistory.map((entry, index) => (
              <div
                key={index}
                onClick={() => onPlayHistorySong(entry.song)}
                className="p-3 rounded-md cursor-pointer transition-colors hover:bg-muted border"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{entry.song.name}</div>
                    {entry.song.metadata?.artist && (
                      <div className="text-sm text-muted-foreground truncate">
                        {entry.song.metadata.artist}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground ml-3">
                    <div>Played {entry.playCount} time{entry.playCount !== 1 ? 's' : ''}</div>
                    <div>{new Date(entry.playedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}