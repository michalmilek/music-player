import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  FolderOpen,
  Music
} from "lucide-react";

interface Song {
  path: string;
  name: string;
  artist?: string;
  album?: string;
  duration?: number;
}

function App() {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const loadMusic = async () => {
    const selected = await open({
      multiple: true,
      filters: [{
        name: 'Audio',
        extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a']
      }]
    });
    
    if (selected && Array.isArray(selected)) {
      const songs: Song[] = selected.map(path => ({
        path,
        name: path.split('/').pop() || path
      }));
      setPlaylist([...playlist, ...songs]);
    }
  };

  const playSong = async (song: Song) => {
    try {
      setCurrentSong(song);
      const songDuration = await invoke<number>("play_song", { path: song.path });
      console.log("Song duration:", songDuration);
      setDuration(songDuration);
      setCurrentTime(0);
      setIsPlaying(true);
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

  const handleSeek = async (newTime: number) => {
    setCurrentTime(newTime);
    try {
      await invoke("seek", { position: newTime });
    } catch (error) {
      console.error("Failed to seek:", error);
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Playlist</h2>
            <button
              onClick={loadMusic}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Add Music
            </button>
          </div>
          <div className="space-y-1">
            {playlist.map((song, index) => (
              <div
                key={index}
                onClick={() => playSong(song)}
                className={`p-3 rounded-md cursor-pointer transition-colors ${
                  currentSong?.path === song.path
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm w-6 text-center">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate">{song.name}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Now Playing */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center mb-8">
                <Music className="w-32 h-32 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {currentSong?.name || 'No song playing'}
              </h2>
              {currentSong?.artist && (
                <p className="text-muted-foreground">{currentSong.artist}</p>
              )}
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