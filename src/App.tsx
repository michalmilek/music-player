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
  Trash2
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

  // Load data from localStorage on app start
  useEffect(() => {
    const savedPlaylist = localStorage.getItem('musicPlayerPlaylist');
    const savedHistory = localStorage.getItem('musicPlayerHistory');
    const savedVolume = localStorage.getItem('musicPlayerVolume');

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Update current time periodically
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 0.1;
        return duration > 0 ? Math.min(newTime, duration) : newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-6 h-6" />
          Tauri Music Player
        </h1>
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
              <div className="flex-1 h-2 bg-muted rounded-lg relative">
                <div
                  className="h-full bg-primary rounded-lg transition-all duration-100"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
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
              >
                <SkipBack className="w-5 h-5" />
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
                onClick={nextSong}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume control */}
            <div className="flex items-center justify-center gap-3">
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
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;