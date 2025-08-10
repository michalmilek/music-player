import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song, AlbumArtwork, PlayHistoryEntry, PlaybackMode } from "../types/music";

export function useAudioPlayer() {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playHistory, setPlayHistory] = useState<PlayHistoryEntry[]>([]);
  const [currentArtwork, setCurrentArtwork] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(PlaybackMode.Linear);
  const [shuffleHistory, setShuffleHistory] = useState<number[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedPlaylist = localStorage.getItem('musicPlayerPlaylist');
    const savedHistory = localStorage.getItem('musicPlayerHistory');
    const savedVolume = localStorage.getItem('musicPlayerVolume');
    const savedMode = localStorage.getItem('musicPlayerMode');

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

    if (savedMode && Object.values(PlaybackMode).includes(savedMode as PlaybackMode)) {
      setPlaybackMode(savedMode as PlaybackMode);
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlist));
  }, [playlist]);

  useEffect(() => {
    localStorage.setItem('musicPlayerHistory', JSON.stringify(playHistory));
  }, [playHistory]);

  useEffect(() => {
    localStorage.setItem('musicPlayerVolume', volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('musicPlayerMode', playbackMode);
  }, [playbackMode]);

  // Periodic timer to update current time from backend
  useEffect(() => {
    let interval: number | null = null;
    
    if (isPlaying && currentSong) {
      interval = window.setInterval(async () => {
        try {
          const backendTime = await invoke<number>("get_current_time");
          setCurrentTime(backendTime);
          
          // Check if song has ended (with small tolerance for timing issues)
          if (duration > 0 && backendTime >= duration - 0.1) {
            console.log("Song ended, handling next song with mode:", playbackMode);
            
            switch (playbackMode) {
              case PlaybackMode.RepeatOne:
                // Restart current song
                try {
                  const songDuration = await invoke<number>("play_song", { path: currentSong.path });
                  setDuration(currentSong.metadata?.duration || songDuration);
                  setCurrentTime(0);
                  setIsPlaying(true);
                } catch (error) {
                  console.error("Failed to repeat song:", error);
                  setIsPlaying(false);
                }
                break;
                
              case PlaybackMode.RepeatAll:
              case PlaybackMode.Shuffle: {
                // Use existing nextSong logic
                const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
                
                let nextIndex: number;
                if (playbackMode === PlaybackMode.Shuffle) {
                  if (playlist.length === 1) {
                    nextIndex = currentIndex;
                  } else if (shuffleHistory.length >= playlist.length - 1) {
                    setShuffleHistory([currentIndex]);
                    const availableIndices = playlist
                      .map((_, index) => index)
                      .filter(index => index !== currentIndex);
                    nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                  } else {
                    const availableIndices = playlist
                      .map((_, index) => index)
                      .filter(index => !shuffleHistory.includes(index) && index !== currentIndex);
                    nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                    setShuffleHistory(prev => [...prev, currentIndex]);
                  }
                } else {
                  nextIndex = (currentIndex + 1) % playlist.length;
                }
                
                try {
                  const nextSong = playlist[nextIndex];
                  setCurrentSong(nextSong);
                  const songDuration = await invoke<number>("play_song", { path: nextSong.path });
                  setDuration(nextSong.metadata?.duration || songDuration);
                  setCurrentTime(0);
                  setIsPlaying(true);
                  
                  if (nextSong.metadata?.has_artwork) {
                    try {
                      const artwork = await invoke<AlbumArtwork | null>("get_album_artwork", { path: nextSong.path });
                      if (artwork) {
                        setCurrentArtwork(`data:${artwork.mime_type};base64,${artwork.data}`);
                      } else {
                        setCurrentArtwork(null);
                      }
                    } catch (error) {
                      console.error("Failed to load artwork:", error);
                      setCurrentArtwork(null);
                    }
                  } else {
                    setCurrentArtwork(null);
                  }
                  
                  // Add to history
                  setPlayHistory(prev => {
                    const existingEntry = prev.find(entry => entry.song.path === nextSong.path);
                    if (existingEntry) {
                      return prev.map(entry =>
                        entry.song.path === nextSong.path
                          ? { ...entry, playCount: entry.playCount + 1, playedAt: new Date().toISOString() }
                          : entry
                      );
                    } else {
                      const newEntry: PlayHistoryEntry = {
                        song: nextSong,
                        playedAt: new Date().toISOString(),
                        playCount: 1
                      };
                      return [newEntry, ...prev].slice(0, 100);
                    }
                  });
                } catch (error) {
                  console.error("Failed to play next song:", error);
                  setIsPlaying(false);
                }
                break;
              }
              
              case PlaybackMode.Linear:
              default: {
                const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
                if (currentIndex < playlist.length - 1) {
                  // Play next song
                  const nextIndex = currentIndex + 1;
                  try {
                    const nextSong = playlist[nextIndex];
                    setCurrentSong(nextSong);
                    const songDuration = await invoke<number>("play_song", { path: nextSong.path });
                    setDuration(nextSong.metadata?.duration || songDuration);
                    setCurrentTime(0);
                    setIsPlaying(true);
                    
                    if (nextSong.metadata?.has_artwork) {
                      try {
                        const artwork = await invoke<AlbumArtwork | null>("get_album_artwork", { path: nextSong.path });
                        if (artwork) {
                          setCurrentArtwork(`data:${artwork.mime_type};base64,${artwork.data}`);
                        } else {
                          setCurrentArtwork(null);
                        }
                      } catch (error) {
                        console.error("Failed to load artwork:", error);
                        setCurrentArtwork(null);
                      }
                    } else {
                      setCurrentArtwork(null);
                    }
                    
                    // Add to history
                    setPlayHistory(prev => {
                      const existingEntry = prev.find(entry => entry.song.path === nextSong.path);
                      if (existingEntry) {
                        return prev.map(entry =>
                          entry.song.path === nextSong.path
                            ? { ...entry, playCount: entry.playCount + 1, playedAt: new Date().toISOString() }
                            : entry
                        );
                      } else {
                        const newEntry: PlayHistoryEntry = {
                          song: nextSong,
                          playedAt: new Date().toISOString(),
                          playCount: 1
                        };
                        return [newEntry, ...prev].slice(0, 100);
                      }
                    });
                  } catch (error) {
                    console.error("Failed to play next song:", error);
                    setIsPlaying(false);
                  }
                } else {
                  // End of playlist in linear mode
                  setIsPlaying(false);
                }
                break;
              }
            }
          }
        } catch (error) {
          console.warn("Failed to get current time:", error);
        }
      }, 100); // Update every 100ms for smooth progress
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentSong, duration, playbackMode, playlist, shuffleHistory]);

  const addToHistory = useCallback((song: Song) => {
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
        return [newEntry, ...prev].slice(0, 100);
      }
    });
  }, []);

  const loadArtwork = useCallback(async (songPath: string) => {
    try {
      const artwork = await invoke<AlbumArtwork | null>("get_album_artwork", { path: songPath });
      if (artwork) {
        setCurrentArtwork(`data:${artwork.mime_type};base64,${artwork.data}`);
      } else {
        setCurrentArtwork(null);
      }
    } catch (error) {
      console.error("Failed to load artwork:", error);
      setCurrentArtwork(null);
    }
  }, []);

  const playSong = useCallback(async (song: Song) => {
    try {
      setCurrentSong(song);
      const songDuration = await invoke<number>("play_song", { path: song.path });
      setDuration(song.metadata?.duration || songDuration);
      setCurrentTime(0);
      setIsPlaying(true);

      await invoke("set_volume", { volume: volume / 100 });

      if (song.metadata?.has_artwork) {
        loadArtwork(song.path);
      } else {
        setCurrentArtwork(null);
      }

      addToHistory(song);
    } catch (error) {
      console.error("Failed to play song:", error);
      setIsPlaying(false);
    }
  }, [volume, loadArtwork, addToHistory]);

  const togglePlay = useCallback(async () => {
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
  }, [currentSong, isPlaying]);

  const getRandomIndex = useCallback((exclude: number[] = []): number => {
    const availableIndices = playlist
      .map((_, index) => index)
      .filter(index => !exclude.includes(index));
    
    if (availableIndices.length === 0) return 0;
    
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
  }, [playlist]);

  const nextSong = useCallback(() => {
    if (!currentSong || playlist.length === 0) return;
    
    const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
    
    switch (playbackMode) {
      case PlaybackMode.RepeatOne:
        playSong(currentSong);
        break;
        
      case PlaybackMode.Shuffle: {
        if (playlist.length === 1) {
          playSong(currentSong);
          break;
        }
        
        let nextIndex: number;
        if (shuffleHistory.length >= playlist.length - 1) {
          setShuffleHistory([currentIndex]);
          nextIndex = getRandomIndex([currentIndex]);
        } else {
          nextIndex = getRandomIndex([...shuffleHistory, currentIndex]);
          setShuffleHistory(prev => [...prev, currentIndex]);
        }
        playSong(playlist[nextIndex]);
        break;
      }
      
      case PlaybackMode.RepeatAll: {
        const nextIndex = (currentIndex + 1) % playlist.length;
        playSong(playlist[nextIndex]);
        break;
      }
      
      case PlaybackMode.Linear:
      default: {
        if (currentIndex < playlist.length - 1) {
          const nextIndex = currentIndex + 1;
          playSong(playlist[nextIndex]);
        }
        break;
      }
    }
  }, [currentSong, playlist, playbackMode, shuffleHistory, playSong, getRandomIndex]);

  const previousSong = useCallback(() => {
    if (!currentSong || playlist.length === 0) return;
    
    const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
    
    switch (playbackMode) {
      case PlaybackMode.RepeatOne:
        playSong(currentSong);
        break;
        
      case PlaybackMode.Shuffle: {
        if (playlist.length === 1) {
          playSong(currentSong);
          break;
        }
        
        if (shuffleHistory.length > 0) {
          const lastIndex = shuffleHistory[shuffleHistory.length - 1];
          setShuffleHistory(prev => prev.slice(0, -1));
          playSong(playlist[lastIndex]);
        } else {
          const randomIndex = getRandomIndex([currentIndex]);
          playSong(playlist[randomIndex]);
        }
        break;
      }
      
      case PlaybackMode.RepeatAll: {
        const previousIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
        playSong(playlist[previousIndex]);
        break;
      }
      
      case PlaybackMode.Linear:
      default: {
        if (currentIndex > 0) {
          const previousIndex = currentIndex - 1;
          playSong(playlist[previousIndex]);
        }
        break;
      }
    }
  }, [currentSong, playlist, playbackMode, shuffleHistory, playSong, getRandomIndex]);

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await invoke("set_volume", { volume: newVolume / 100 });
    } catch (error) {
      console.error("Failed to set volume:", error);
    }
  }, []);

  const seek = useCallback(async (position: number) => {
    if (!currentSong) return;
    
    // Immediately update the UI for responsive feedback
    setCurrentTime(position);
    
    try {
      // Send seek command to backend
      await invoke("seek", { position });
      
      // After a short delay, sync with backend to ensure accuracy
      setTimeout(async () => {
        try {
          const backendTime = await invoke<number>("get_current_time");
          setCurrentTime(backendTime);
        } catch (error) {
          console.warn("Failed to sync time with backend:", error);
        }
      }, 100); // Small delay to let backend process the seek
    } catch (error) {
      console.warn("Seek failed:", error);
      // On error, try to get the actual time from backend
      try {
        const backendTime = await invoke<number>("get_current_time");
        setCurrentTime(backendTime);
      } catch (syncError) {
        console.warn("Failed to sync time after seek error:", syncError);
      }
    }
  }, [currentSong]);

  const skipBackward = useCallback(async (seconds: number = 10) => {
    if (!currentSong) return;
    const newTime = Math.max(0, currentTime - seconds);
    await seek(newTime);
  }, [currentSong, currentTime, seek]);

  const skipForward = useCallback(async (seconds: number = 10) => {
    if (!currentSong) return;
    const newTime = Math.min(duration, currentTime + seconds);
    await seek(newTime);
  }, [currentSong, currentTime, duration, seek]);

  const clearPlaylist = useCallback(() => {
    setPlaylist([]);
    setCurrentSong(null);
    setIsPlaying(false);
  }, []);

  const clearHistory = useCallback(() => {
    setPlayHistory([]);
  }, []);

  const addSongsToPlaylist = useCallback((songs: Song[]) => {
    setPlaylist(prev => [...prev, ...songs]);
  }, []);

  const reorderPlaylist = useCallback((fromIndex: number, toIndex: number) => {
    setPlaylist(prev => {
      const newPlaylist = [...prev];
      const [draggedItem] = newPlaylist.splice(fromIndex, 1);
      newPlaylist.splice(toIndex, 0, draggedItem);
      return newPlaylist;
    });
  }, []);

  const togglePlaybackMode = useCallback(() => {
    const modes = [PlaybackMode.Linear, PlaybackMode.RepeatAll, PlaybackMode.RepeatOne, PlaybackMode.Shuffle];
    const currentIndex = modes.indexOf(playbackMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setPlaybackMode(modes[nextIndex]);
    
    if (modes[nextIndex] !== PlaybackMode.Shuffle) {
      setShuffleHistory([]);
    }
  }, [playbackMode]);

  return {
    // State
    playlist,
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    playHistory,
    currentArtwork,
    playbackMode,
    
    // Actions
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
    setCurrentTime,
  };
}