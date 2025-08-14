import { useState } from "react";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { 
  Keyboard, 
  X, 
  RotateCcw,
  Power,
  PowerOff,
  Save,
  AlertCircle,
  CheckCircle 
} from "lucide-react";

interface GlobalHotkeysSettingsProps {
  audioPlayerActions: {
    togglePlay: () => void;
    nextSong: () => void;
    previousSong: () => void;
    handleVolumeChange: (volume: number) => void;
    volume: number;
    showWindow?: () => void;
  };
  onClose: () => void;
}

export function GlobalHotkeysSettings({ audioPlayerActions, onClose }: GlobalHotkeysSettingsProps) {
  const {
    shortcuts,
    enabled,
    updateShortcut,
    toggleGlobalShortcuts,
    resetToDefaults,
    getAvailableShortcuts,
    isShortcutRegistered
  } = useGlobalShortcuts(audioPlayerActions);

  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [newShortcutValue, setNewShortcutValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const shortcutLabels = {
    playPause: "Play/Pause",
    nextSong: "Next Song",
    previousSong: "Previous Song", 
    volumeUp: "Volume Up",
    volumeDown: "Volume Down",
    mute: "Mute/Unmute",
    showWindow: "Show Window"
  };

  const shortcutDescriptions = {
    playPause: "Toggle playback",
    nextSong: "Skip to next track",
    previousSong: "Go to previous track",
    volumeUp: "Increase volume by 5%",
    volumeDown: "Decrease volume by 5%",
    mute: "Toggle mute",
    showWindow: "Show/focus application window"
  };

  const handleSaveShortcut = async (action: string) => {
    if (!newShortcutValue.trim()) return;
    
    setSaveStatus("saving");
    try {
      await updateShortcut(action as keyof typeof shortcuts, newShortcutValue);
      setEditingShortcut(null);
      setNewShortcutValue("");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save shortcut:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleCancelEdit = () => {
    setEditingShortcut(null);
    setNewShortcutValue("");
    setShowSuggestions(false);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setNewShortcutValue(suggestion);
    setShowSuggestions(false);
  };

  const handleReset = async () => {
    setSaveStatus("saving");
    try {
      await resetToDefaults();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to reset shortcuts:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const availableShortcuts = getAvailableShortcuts();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Keyboard className="w-5 h-5" />
                Global Hotkeys
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Control music playback from anywhere on your system
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Enable/Disable Toggle */}
          <div className="mb-6 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  {enabled ? (
                    <Power className="w-4 h-4 text-green-600" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-gray-400" />
                  )}
                  Global Hotkeys
                </h3>
                <p className="text-sm text-muted-foreground">
                  {enabled ? "Hotkeys are active system-wide" : "Hotkeys are disabled"}
                </p>
              </div>
              <button
                onClick={() => toggleGlobalShortcuts(!enabled)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  enabled 
                    ? "bg-red-100 text-red-700 hover:bg-red-200" 
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {saveStatus === "saved" && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">Settings saved successfully!</span>
            </div>
          )}

          {saveStatus === "error" && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">Failed to save settings. Please try again.</span>
            </div>
          )}

          {/* Shortcuts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Keyboard Shortcuts</h3>
              <button
                onClick={handleReset}
                disabled={saveStatus === "saving"}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </button>
            </div>

            {Object.entries(shortcuts).map(([action, keys]) => (
              <div key={action} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {shortcutLabels[action as keyof typeof shortcutLabels]}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {shortcutDescriptions[action as keyof typeof shortcutDescriptions]}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {editingShortcut === action ? (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={newShortcutValue}
                            onChange={(e) => setNewShortcutValue(e.target.value)}
                            placeholder="e.g., CommandOrControl+Space"
                            className="w-48 p-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            onFocus={() => setShowSuggestions(true)}
                          />
                          
                          {/* Suggestions Dropdown */}
                          {showSuggestions && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                              {availableShortcuts
                                .filter(shortcut => 
                                  shortcut.toLowerCase().includes(newShortcutValue.toLowerCase())
                                )
                                .slice(0, 8)
                                .map(shortcut => (
                                  <button
                                    key={shortcut}
                                    onClick={() => handleSuggestionSelect(shortcut)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                                  >
                                    {shortcut}
                                  </button>
                                ))
                              }
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleSaveShortcut(action)}
                          disabled={!newShortcutValue.trim() || saveStatus === "saving"}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="px-3 py-1 bg-muted rounded-md font-mono text-sm">
                            {keys || "Not set"}
                          </div>
                          {keys && isShortcutRegistered(keys) && (
                            <div className="text-xs text-green-600 mt-1">Active</div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => {
                            setEditingShortcut(action);
                            setNewShortcutValue(keys);
                            setShowSuggestions(false);
                          }}
                          disabled={!enabled}
                          className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-muted/20 rounded-lg">
            <h4 className="font-medium mb-2">Tips:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Use <code className="bg-muted px-1 rounded">CommandOrControl</code> for Ctrl on Windows/Linux and Cmd on macOS</li>
              <li>• Media keys (MediaPlayPause, MediaNextTrack, etc.) work without modifiers</li>
              <li>• Some shortcuts may be reserved by your system</li>
              <li>• Global hotkeys work even when the app is not focused</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}