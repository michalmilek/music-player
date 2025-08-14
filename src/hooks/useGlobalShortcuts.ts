import { useEffect, useState } from "react";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";

export interface GlobalShortcut {
  id: string;
  keys: string;
  description: string;
  action: () => void;
  enabled: boolean;
}

interface GlobalShortcutConfig {
  playPause: string;
  nextSong: string;
  previousSong: string;
  volumeUp: string;
  volumeDown: string;
  mute: string;
  showWindow: string;
}

const DEFAULT_SHORTCUTS: GlobalShortcutConfig = {
  playPause: "MediaPlayPause",
  nextSong: "MediaNextTrack", 
  previousSong: "MediaPreviousTrack",
  volumeUp: "VolumeUp",
  volumeDown: "VolumeDown",
  mute: "VolumeMute",
  showWindow: "CommandOrControl+Shift+M"
};

export function useGlobalShortcuts(audioPlayerActions: {
  togglePlay: () => void;
  nextSong: () => void;
  previousSong: () => void;
  handleVolumeChange: (volume: number) => void;
  volume: number;
  showWindow?: () => void;
}) {
  const [shortcuts, setShortcuts] = useState<GlobalShortcutConfig>(DEFAULT_SHORTCUTS);
  const [registeredShortcuts, setRegisteredShortcuts] = useState<Set<string>>(new Set());
  const [enabled, setEnabled] = useState(true);

  // Load shortcuts from localStorage
  useEffect(() => {
    const savedShortcuts = localStorage.getItem('globalShortcuts');
    const savedEnabled = localStorage.getItem('globalShortcutsEnabled');
    
    if (savedShortcuts) {
      try {
        setShortcuts(JSON.parse(savedShortcuts));
      } catch (error) {
        console.error('Error loading shortcuts:', error);
      }
    }
    
    if (savedEnabled !== null) {
      setEnabled(savedEnabled === 'true');
    }
  }, []);

  // Save shortcuts to localStorage
  useEffect(() => {
    localStorage.setItem('globalShortcuts', JSON.stringify(shortcuts));
  }, [shortcuts]);

  useEffect(() => {
    localStorage.setItem('globalShortcutsEnabled', enabled.toString());
  }, [enabled]);

  // Register a single shortcut
  const registerShortcut = async (keys: string, callback: () => void): Promise<boolean> => {
    try {
      // Check if already registered
      const alreadyRegistered = await isRegistered(keys);
      if (alreadyRegistered) {
        await unregister(keys);
      }
      
      await register(keys, callback);
      setRegisteredShortcuts(prev => new Set([...prev, keys]));
      return true;
    } catch (error) {
      console.error(`Failed to register shortcut ${keys}:`, error);
      return false;
    }
  };

  // Unregister a single shortcut
  const unregisterShortcut = async (keys: string): Promise<boolean> => {
    try {
      await unregister(keys);
      setRegisteredShortcuts(prev => {
        const newSet = new Set(prev);
        newSet.delete(keys);
        return newSet;
      });
      return true;
    } catch (error) {
      console.error(`Failed to unregister shortcut ${keys}:`, error);
      return false;
    }
  };

  // Register all shortcuts
  const registerAllShortcuts = async () => {
    if (!enabled) return;

    const shortcutActions: Record<keyof GlobalShortcutConfig, () => void> = {
      playPause: audioPlayerActions.togglePlay,
      nextSong: audioPlayerActions.nextSong,
      previousSong: audioPlayerActions.previousSong,
      volumeUp: () => {
        const newVolume = Math.min(100, audioPlayerActions.volume + 5);
        audioPlayerActions.handleVolumeChange(newVolume);
      },
      volumeDown: () => {
        const newVolume = Math.max(0, audioPlayerActions.volume - 5);
        audioPlayerActions.handleVolumeChange(newVolume);
      },
      mute: () => {
        const newVolume = audioPlayerActions.volume === 0 ? 50 : 0;
        audioPlayerActions.handleVolumeChange(newVolume);
      },
      showWindow: audioPlayerActions.showWindow || (() => {
        // Default implementation to focus window
        if (window) {
          window.focus();
        }
      })
    };

    // Register each shortcut
    for (const [action, keys] of Object.entries(shortcuts)) {
      if (keys && shortcutActions[action as keyof GlobalShortcutConfig]) {
        await registerShortcut(keys, shortcutActions[action as keyof GlobalShortcutConfig]);
      }
    }
  };

  // Unregister all shortcuts
  const unregisterAllShortcuts = async () => {
    for (const keys of registeredShortcuts) {
      await unregisterShortcut(keys);
    }
  };

  // Update a specific shortcut
  const updateShortcut = async (action: keyof GlobalShortcutConfig, newKeys: string) => {
    const oldKeys = shortcuts[action];
    
    // Unregister old shortcut if it exists
    if (oldKeys) {
      await unregisterShortcut(oldKeys);
    }
    
    // Update the shortcut configuration
    setShortcuts(prev => ({
      ...prev,
      [action]: newKeys
    }));
  };

  // Enable/disable global shortcuts
  const toggleGlobalShortcuts = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    
    if (newEnabled) {
      await registerAllShortcuts();
    } else {
      await unregisterAllShortcuts();
    }
  };

  // Reset to default shortcuts
  const resetToDefaults = async () => {
    await unregisterAllShortcuts();
    setShortcuts(DEFAULT_SHORTCUTS);
  };

  // Register shortcuts when enabled changes or shortcuts change
  useEffect(() => {
    if (enabled) {
      registerAllShortcuts();
    } else {
      unregisterAllShortcuts();
    }

    // Cleanup on unmount
    return () => {
      unregisterAllShortcuts();
    };
  }, [enabled, shortcuts, audioPlayerActions.volume]);

  // Get available shortcut combinations
  const getAvailableShortcuts = () => {
    return [
      // Media keys
      'MediaPlayPause',
      'MediaNextTrack', 
      'MediaPreviousTrack',
      'VolumeUp',
      'VolumeDown',
      'VolumeMute',
      
      // Function keys
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
      
      // Modifier combinations
      'CommandOrControl+Space',
      'CommandOrControl+Shift+Space',
      'CommandOrControl+Alt+Space',
      'CommandOrControl+Shift+P',
      'CommandOrControl+Shift+N',
      'CommandOrControl+Shift+M',
      'CommandOrControl+Shift+Up',
      'CommandOrControl+Shift+Down',
      'CommandOrControl+Shift+Left',
      'CommandOrControl+Shift+Right',
      
      // Alt combinations
      'Alt+Space',
      'Alt+P',
      'Alt+N',
      'Alt+M',
      'Alt+Up',
      'Alt+Down',
      'Alt+Left',
      'Alt+Right'
    ];
  };

  return {
    shortcuts,
    enabled,
    registeredShortcuts: Array.from(registeredShortcuts),
    updateShortcut,
    toggleGlobalShortcuts,
    resetToDefaults,
    getAvailableShortcuts,
    isShortcutRegistered: (keys: string) => registeredShortcuts.has(keys)
  };
}