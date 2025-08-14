import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  X, 
  Settings,
  Volume,
  Clock,
  TrendingUp,
  Save,
  Power,
  PowerOff
} from "lucide-react";

interface CrossfadeConfig {
  enabled: boolean;
  duration_seconds: number;
  curve_type: "Linear" | "EqualPower" | "Logarithmic" | "SCurve";
}

interface CrossfadeSettingsProps {
  onClose: () => void;
  onSettingsChange?: () => void;
}

export function CrossfadeSettings({ onClose, onSettingsChange }: CrossfadeSettingsProps) {
  const [config, setConfig] = useState<CrossfadeConfig>({
    enabled: false,
    duration_seconds: 3.0,
    curve_type: "EqualPower"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load current configuration
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const result = await invoke<CrossfadeConfig | null>("get_crossfade_config");
      if (result) {
        setConfig(result);
      }
    } catch (error) {
      console.error("Failed to load crossfade config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCrossfade = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      await invoke("enable_crossfade", { enabled });
      setConfig(prev => ({ ...prev, enabled }));
      onSettingsChange?.();
    } catch (error) {
      console.error("Failed to toggle crossfade:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDurationChange = async (duration: number) => {
    setIsSaving(true);
    try {
      await invoke("set_crossfade_duration", { duration });
      setConfig(prev => ({ ...prev, duration_seconds: duration }));
    } catch (error) {
      console.error("Failed to set crossfade duration:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const curveDescriptions = {
    Linear: "Simple linear fade - gradual and predictable",
    EqualPower: "Maintains constant perceived volume - recommended for most music",
    Logarithmic: "Quick fade out, slow fade in - good for electronic music",
    SCurve: "Smooth S-curve transition - natural sounding for acoustic music"
  };

  const curveIcons = {
    Linear: TrendingUp,
    EqualPower: Volume,
    Logarithmic: Clock,
    SCurve: Settings
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background border rounded-lg p-6">
          <div className="text-center">Loading crossfade settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Crossfade Settings
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure smooth transitions between tracks
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
                  {config.enabled ? (
                    <Power className="w-4 h-4 text-green-600" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-gray-400" />
                  )}
                  Crossfade
                </h3>
                <p className="text-sm text-muted-foreground">
                  {config.enabled ? "Smooth transitions are active" : "Crossfade is disabled"}
                </p>
              </div>
              <button
                onClick={() => handleToggleCrossfade(!config.enabled)}
                disabled={isSaving}
                className={`px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                  config.enabled 
                    ? "bg-red-100 text-red-700 hover:bg-red-200" 
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {config.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>

          {/* Duration Setting */}
          <div className="mb-6 p-4 border rounded-lg">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Crossfade Duration
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm text-muted-foreground min-w-[80px]">
                  {config.duration_seconds.toFixed(1)}s
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={config.duration_seconds}
                  onChange={(e) => {
                    const duration = parseFloat(e.target.value);
                    setConfig(prev => ({ ...prev, duration_seconds: duration }));
                  }}
                  onMouseUp={(e) => {
                    const duration = parseFloat((e.target as HTMLInputElement).value);
                    handleDurationChange(duration);
                  }}
                  disabled={!config.enabled || isSaving}
                  className="flex-1"
                />
                <div className="text-sm text-muted-foreground min-w-[120px] text-right">
                  0.5s - 10.0s
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Longer durations create smoother transitions but may feel sluggish.
                Shorter durations are more responsive but less seamless.
              </div>
            </div>
          </div>

          {/* Crossfade Curve Selection */}
          <div className="mb-6 p-4 border rounded-lg">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Crossfade Curve
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(curveDescriptions).map(([curve, description]) => {
                const IconComponent = curveIcons[curve as keyof typeof curveIcons];
                return (
                  <button
                    key={curve}
                    onClick={() => setConfig(prev => ({ ...prev, curve_type: curve as any }))}
                    disabled={!config.enabled || isSaving}
                    className={`p-4 border rounded-lg text-left transition-colors disabled:opacity-50 ${
                      config.curve_type === curve
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent className="w-4 h-4" />
                      <span className="font-medium">{curve}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview Section */}
          <div className="p-4 bg-muted/20 rounded-lg">
            <h4 className="font-medium mb-2">How It Works</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Crossfade automatically plays during track transitions</li>
              <li>• The next track starts playing at low volume before the current track ends</li>
              <li>• Volume gradually shifts from the current track to the next track</li>
              <li>• Works with both manual track changes and automatic playlist progression</li>
              <li>• Can be bypassed for immediate track changes when needed</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Changes are applied immediately
            </div>
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