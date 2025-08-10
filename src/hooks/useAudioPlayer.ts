import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song, AlbumArtwork, PlayHistoryEntry } from "../types/music";

export function useAudioPlayer() {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playHistory, setPlayHistory] = useState<PlayHistoryEntry[]>([]);
  const [currentArtwork, setCurrentArtwork] = useState<string | null>(null);

  // Load data from localStorage on mount
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

  const nextSong = useCallback(() => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex]);
  }, [currentSong, playlist, playSong]);

  const previousSong = useCallback(() => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.path === currentSong.path);
    const previousIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    playSong(playlist[previousIndex]);
  }, [currentSong, playlist, playSong]);

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
    setCurrentTime,
  };
}