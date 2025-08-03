import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  FolderOpen,
  Music,
  Trash2,
  RotateCcw,
  RotateCw,
  Settings,
  HelpCircle,
  X
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

interface TrackMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  track_number: number | null;
  year: number | null;
  genre: string | null;
  duration: number;
  codec: string | null;
  sample_rate: number | null;
  channels: string | null;
  bits_per_sample: number | null;
}

interface Song {
  path: string;
  name: string;
  metadata?: TrackMetadata;
}

interface PlayHistoryEntry {
  song: Song;
  playedAt: string;
  playCount: number;
}

function App() {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playHistory, setPlayHistory] = useState<PlayHistoryEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [skipAmount, setSkipAmount] = useState(10);
  const [showHelp, setShowHelp] = useState(false);

  // Load data from localStorage on app start
  useEffect(() => {
    const savedPlaylist = localStorage.getItem('musicPlayerPlaylist');
    const savedHistory = localStorage.getItem('musicPlayerHistory');
    const savedVolume = localStorage.getItem('musicPlayerVolume');
    const savedSkipAmount = localStorage.getItem('musicPlayerSkipAmount');

    if (savedPlaylist) {
      try {
        setPlaylist(JSON.parse(savedPlaylist));
      } catch (error) {
        console.error('Error loading playlist:', error);
      }
    }

    if (savedHistory) {
      try {
        setPlayHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }

    if (savedVolume) {
      setVolume(parseInt(savedVolume));
    }

    if (savedSkipAmount) {
      setSkipAmount(parseInt(savedSkipAmount));
    }
  }, []);

  // Save playlist to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlist));
  }, [playlist]);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('musicPlayerHistory', JSON.stringify(playHistory));
  }, [playHistory]);

  // Save volume to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('musicPlayerVolume', volume.toString());
  }, [volume]);

  // Save skip amount to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('musicPlayerSkipAmount', skipAmount.toString());
  }, [skipAmount]);

  const addToHistory = (song: Song) => {
    setPlayHistory(prev => {
      const existingEntry = prev.find(entry => entry.song.path === song.path);
      if (existingEntry) {
        return prev.map(entry =>
          entry.song.path === song.path
            ? { ...entry, playCount: entry.playCount + 1, playedAt: new Date().toISOString() }
            : entry
        );
      } else {
        const newEntry: PlayHistoryEntry = {
          song,
          playedAt: new Date().toISOString(),
          playCount: 1
        };
        return [newEntry, ...prev].slice(0, 100); // Keep only last 100 entries
      }
    });
  };

  const clearHistory = () => {
    setPlayHistory([]);
  };

  const clearPlaylist = () => {
    setPlaylist([]);
    setCurrentSong(null);
    setIsPlaying(false);
  };

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

      setPlaylist([...playlist, ...songs]);
    }
  };

  const playSong = async (song: Song) => {
    try {
      setCurrentSong(song);
      const songDuration = await invoke<number>("play_song", { path: song.path });
      console.log("Song duration:", songDuration);
      setDuration(song.metadata?.duration || songDuration);
      setCurrentTime(0);
      setIsPlaying(true);

      // Apply current volume to new song
      await invoke("set_volume", { volume: volume / 100 });

      // Add to play history
      addToHistory(song);
    } catch (error) {
      console.error("Failed to play song:", error);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (!currentSong) return;

    try {
      if (isPlaying) {
        await invoke("pause");
      } else {
        await invoke("resume");
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Failed to toggle play:", error);
    }
  };

  const nextSong = () => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex]);
  };

  const previousSong = () => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
    const previousIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    playSong(playlist[previousIndex]);
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await invoke("set_volume", { volume: newVolume / 100 });
    } catch (error) {
      console.error("Failed to set volume:", error);
    }
  };

  const skipBackward = async (seconds: number = 10) => {
    if (!currentSong) return;
    const newTime = Math.max(0, currentTime - seconds);
    setCurrentTime(newTime);
    try {
      await invoke("seek", { position: newTime });
    } catch (error) {
      console.warn("Skip backward failed:", error);
    }
  };

  const skipForward = async (seconds: number = 10) => {
    if (!currentSong) return;
    const newTime = Math.min(duration, currentTime + seconds);
    setCurrentTime(newTime);
    try {
      await invoke("seek", { position: newTime });
    } catch (error) {
      console.warn("Skip forward failed:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateTimeFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    return percentage * duration;
  };

  const handleProgressClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentSong || duration === 0 || isDragging) return;

    const newTime = calculateTimeFromEvent(e, e.currentTarget);
    console.log(`Seeking to ${newTime.toFixed(2)}s`);
    
    setCurrentTime(newTime);
    
    try {
      await invoke("seek", { position: newTime });
      console.log("Seek successful");
    } catch (error) {
      console.warn("Seeking failed:", error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentSong || duration === 0) return;
    setIsDragging(true);
    const newTime = calculateTimeFromEvent(e, e.currentTarget);
    setCurrentTime(newTime);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !currentSong || duration === 0) return;
    const progressBar = document.querySelector('.progress-bar') as HTMLDivElement;
    if (progressBar) {
      const newTime = calculateTimeFromEvent(e, progressBar);
      setCurrentTime(newTime);
    }
  };

  const handleMouseUp = async () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    try {
      await invoke("seek", { position: currentTime });
      console.log("Drag seek successful");
    } catch (error) {
      console.warn("Drag seeking failed:", error);
    }
  };

  // Add mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, currentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
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
          e.preventDefault();
          handleVolumeChange(volume === 0 ? 50 : 0); // Mute/unmute
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
  }, [isPlaying, volume, skipAmount, currentSong, playlist]);

  // Update current time periodically (but not while dragging)
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Music className="w-6 h-6" />
            Tauri Music Player
          </h1>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            title="Keyboard shortcuts (Ctrl+H)"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Playlist */}
        <aside className="w-80 border-r p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold">Playlist</h2>
            <div className="flex gap-3">
              <button
                onClick={clearPlaylist}
                disabled={playlist.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
              <button
                onClick={loadMusic}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Add Music
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {playlist.map((song, index) => (
              <div
                key={index}
                onClick={() => playSong(song)}
                className={`p-3 rounded-md cursor-pointer transition-colors ${currentSong?.path === song.path
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm w-6 text-center">
                    {song.metadata?.track_number || index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{song.name}</div>
                    {song.metadata?.artist && (
                      <div className="text-sm text-muted-foreground truncate">
                        {song.metadata.artist}
                        {song.metadata.album && ` • ${song.metadata.album}`}
                      </div>
                    )}
                  </div>
                  {song.metadata?.duration && (
                    <span className="text-sm text-muted-foreground">
                      {formatTime(song.metadata.duration)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Now Playing */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center mb-6 mx-auto">
                  <Music className="w-32 h-32 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  {currentSong?.metadata?.title || currentSong?.name || 'No song playing'}
                </h2>
                {currentSong?.metadata?.artist && (
                  <p className="text-lg text-muted-foreground">
                    {currentSong.metadata.artist}
                  </p>
                )}
              </div>

              <Tabs defaultValue={currentSong ? "metadata" : "history"} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="metadata" disabled={!currentSong}>Metadata</TabsTrigger>
                  <TabsTrigger value="technical" disabled={!currentSong}>Technical Info</TabsTrigger>
                  <TabsTrigger value="history">Play History</TabsTrigger>
                </TabsList>

                {currentSong && (
                  <>
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

                <TabsContent value="history" className="mt-6">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <h3 className="text-lg font-semibold">Play History</h3>
                    <button
                      onClick={clearHistory}
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
                          onClick={() => playSong(entry.song)}
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
            </div>
          </div>

          {/* Controls */}
          <div className="border-t p-6">
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-muted-foreground w-12 text-right">
                {formatTime(currentTime)}
              </span>
              <div 
                className="flex-1 h-2 bg-muted rounded-lg relative cursor-pointer progress-bar" 
                onClick={handleProgressClick}
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

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={previousSong}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                title="Previous song"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={() => skipBackward(10)}
                disabled={!currentSong}
                className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Skip backward 10s"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>
              <button
                onClick={() => skipForward(10)}
                disabled={!currentSong}
                className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Skip forward 10s"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button
                onClick={nextSong}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                title="Next song"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume control */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-32 h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
              <span className="text-sm text-muted-foreground w-10 text-right">
                {volume}%
              </span>
            </div>

            {/* Custom skip controls */}
            <div className="flex items-center justify-center gap-3">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Skip:</span>
              <button
                onClick={() => skipBackward(skipAmount)}
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
                onChange={(e) => setSkipAmount(Math.max(1, Math.min(60, Number(e.target.value))))}
                className="w-12 px-1 py-1 text-xs text-center bg-muted rounded border-0 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => skipForward(skipAmount)}
                disabled={!currentSong}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Skip forward ${skipAmount}s`}
              >
                +{skipAmount}s
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
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
    </div>
  );
}

export default App;