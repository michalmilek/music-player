import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Music, HelpCircle, X, Minimize2, FolderOpen, FolderSearch, Download } from "lucide-react";
import { Song, TrackMetadata } from "./types/music";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { Playlist } from "./components/Playlist";
import { NowPlaying } from "./components/NowPlaying";
import { PlayerControls } from "./components/PlayerControls";
import { VolumeControl } from "./components/VolumeControl";
import { ProgressBar } from "./components/ProgressBar";
import { SkipControls } from "./components/SkipControls";
import { PlaybackInfo } from "./components/PlaybackInfo";
import { MiniPlayer } from "./components/MiniPlayer";
import { MusicLibraryImport } from "./components/MusicLibraryImport";
import { PlaylistExport } from "./components/PlaylistExport";

function App() {
  const {
    playlist,
    playlistWithRatings,
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    playHistory,
    currentArtwork,
    playbackMode,
    playSong,
    togglePlay,
    nextSong,
    previousSong,
    handleVolumeChange,
    seek,
    skipBackward,
    skipForward,
    clearPlaylist,
    clearHistory,
    addSongsToPlaylist,
    reorderPlaylist,
    togglePlaybackMode,
    setSongRating,
    getSongRating,
  } = useAudioPlayer();

  const [showHelp, setShowHelp] = useState(false);
  const [equalizerEnabled, setEqualizerEnabled] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [showLibraryImport, setShowLibraryImport] = useState(false);
  const [showPlaylistExport, setShowPlaylistExport] = useState(false);
  const [skipAmount, setSkipAmount] = useState(10);

  // Load skip amount from localStorage
  useEffect(() => {
    const savedSkipAmount = localStorage.getItem('musicPlayerSkipAmount');
    if (savedSkipAmount) {
      setSkipAmount(parseInt(savedSkipAmount));
    }
  }, []);

  // Save skip amount to localStorage
  useEffect(() => {
    localStorage.setItem('musicPlayerSkipAmount', skipAmount.toString());
  }, [skipAmount]);

  const loadMusic = async () => {
    const selected = await open({
      multiple: true,
      filters: [{
        name: 'Audio',
        extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a']
      }]
    });

    if (selected && Array.isArray(selected)) {
      const songs: Song[] = [];

      for (const path of selected) {
        try {
          const metadata = await invoke<TrackMetadata>("get_track_metadata", { path });
          songs.push({
            path,
            name: metadata.title || path.split('/').pop() || path,
            metadata
          });
        } catch (error) {
          console.error("Failed to get metadata for", path, error);
          songs.push({
            path,
            name: path.split('/').pop() || path
          });
        }
      }

      addSongsToPlaylist(songs);
    }
  };

  const handleLibraryImport = (importedFiles: any[]) => {
    const songs: Song[] = importedFiles.map(file => ({
      path: file.path,
      name: file.metadata?.title || file.name,
      metadata: file.metadata ? {
        ...file.metadata,
        track_number: null,
        year: null,
        genre: null,
        codec: null,
        sample_rate: null,
        channels: null,
        bits_per_sample: null,
        has_artwork: false
      } : undefined
    }));

    addSongsToPlaylist(songs);
    setShowLibraryImport(false);
  };

  const handleEqualizerToggle = async (enabled: boolean) => {
    setEqualizerEnabled(enabled);
    try {
      await invoke("enable_equalizer", { enabled });
    } catch (error) {
      console.error("Failed to toggle equalizer:", error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            skipBackward(skipAmount);
          } else {
            skipBackward(10);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            skipForward(skipAmount);
          } else {
            skipForward(10);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(100, volume + 5));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 5));
          break;
        case 'KeyN':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            nextSong();
          }
          break;
        case 'KeyP':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            previousSong();
          }
          break;
        case 'KeyM':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setIsMiniPlayer(!isMiniPlayer);
          } else {
            e.preventDefault();
            handleVolumeChange(volume === 0 ? 50 : 0);
          }
          break;
        case 'KeyH':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setShowHelp(true);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowHelp(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    skipBackward,
    skipForward,
    handleVolumeChange,
    nextSong,
    previousSong,
    volume,
    skipAmount,
    isMiniPlayer
  ]);

  if (isMiniPlayer) {
    return (
      <>
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <Music className="w-32 h-32 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Mini Player Mode</h2>
              <p className="text-muted-foreground mb-6">
                The player controls are at the bottom of your screen
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={loadMusic}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <FolderOpen className="w-5 h-5" />
                  Add Files
                </button>
                <button
                  onClick={() => setShowLibraryImport(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                >
                  <FolderSearch className="w-5 h-5" />
                  Import Library
                </button>
                <button
                  onClick={() => setShowPlaylistExport(true)}
                  disabled={playlist.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-5 h-5" />
                  Export Playlist
                </button>
              </div>
            </div>
            
            <div className="bg-muted/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Playlist ({playlist.length} songs)</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {playlist.map((song, index) => (
                  <div
                    key={index}
                    onClick={() => playSong(song)}
                    className={`p-3 rounded-md cursor-pointer transition-colors flex items-center gap-3 ${
                      currentSong?.path === song.path
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="text-sm text-muted-foreground w-8 text-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{song.name}</div>
                      {song.metadata?.artist && (
                        <div className="text-xs text-muted-foreground truncate">
                          {song.metadata.artist}
                        </div>
                      )}
                    </div>
                    {song.metadata?.duration && (
                      <span className="text-xs text-muted-foreground">
                        {Math.floor(song.metadata.duration / 60)}:{(Math.floor(song.metadata.duration % 60)).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <MiniPlayer
          currentSong={currentSong}
          isPlaying={isPlaying}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
          currentArtwork={currentArtwork}
          onTogglePlay={togglePlay}
          onPrevious={previousSong}
          onNext={nextSong}
          onVolumeChange={handleVolumeChange}
          onExpand={() => setIsMiniPlayer(false)}
          onSeek={seek}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Music className="w-6 h-6" />
            Tauri Music Player
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMiniPlayer(true)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Mini player mode"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Keyboard shortcuts (Ctrl+H)"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        <Playlist
          playlist={playlistWithRatings}
          currentSong={currentSong}
          onSongSelect={playSong}
          onClearPlaylist={clearPlaylist}
          onLoadMusic={loadMusic}
          onImportLibrary={() => setShowLibraryImport(true)}
          onExportPlaylist={() => setShowPlaylistExport(true)}
          onReorderPlaylist={reorderPlaylist}
          onSetRating={setSongRating}
        />

        {/* Now Playing */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
              <NowPlaying 
                currentSong={currentSong ? {...currentSong, rating: getSongRating(currentSong.path)} : null}
                currentArtwork={currentArtwork}
                onSetRating={setSongRating}
              />

              <PlaybackInfo
                currentSong={currentSong}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                equalizerEnabled={equalizerEnabled}
                playHistory={playHistory}
                onEqualizerToggle={handleEqualizerToggle}
                onClearHistory={clearHistory}
                onPlayHistorySong={playSong}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="border-t p-6">
            <div className="mb-4">
              <ProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeek={(time) => {
                  // Immediately update UI for responsive feedback
                  seek(time);
                }}
              />
            </div>

            <div className="mb-4">
              <PlayerControls
                isPlaying={isPlaying}
                currentSong={currentSong}
                playbackMode={playbackMode}
                onTogglePlay={togglePlay}
                onPrevious={previousSong}
                onNext={nextSong}
                onSkipBackward={skipBackward}
                onSkipForward={skipForward}
                onTogglePlaybackMode={togglePlaybackMode}
              />
            </div>

            <div className="mb-4">
              <VolumeControl
                volume={volume}
                onVolumeChange={handleVolumeChange}
              />
            </div>

            <SkipControls
              skipAmount={skipAmount}
              currentSong={currentSong}
              onSkipAmountChange={setSkipAmount}
              onSkipBackward={skipBackward}
              onSkipForward={skipForward}
            />
          </div>
        </main>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Play/Pause</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skip backward 10s</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">←</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skip forward 10s</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">→</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skip backward (custom)</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Shift + ←</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skip forward (custom)</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Shift + →</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume up</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">↑</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume down</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">↓</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mute/Unmute</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">M</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous song</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + P</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next song</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + N</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toggle mini player</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + M</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Show this help</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl + H</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Close help</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Music Library Import */}
      {showLibraryImport && (
        <MusicLibraryImport
          onImport={handleLibraryImport}
          onClose={() => setShowLibraryImport(false)}
        />
      )}

      {/* Playlist Export */}
      {showPlaylistExport && (
        <PlaylistExport
          playlist={playlist}
          onClose={() => setShowPlaylistExport(false)}
        />
      )}
    </div>
  );
}

export default App;