import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface EqualizerProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

interface EqualizerBand {
  frequency: number;
  gain: number;
  label: string;
}

const DEFAULT_BANDS: EqualizerBand[] = [
  { frequency: 32, gain: 0, label: '32Hz' },
  { frequency: 64, gain: 0, label: '64Hz' },
  { frequency: 125, gain: 0, label: '125Hz' },
  { frequency: 250, gain: 0, label: '250Hz' },
  { frequency: 500, gain: 0, label: '500Hz' },
  { frequency: 1000, gain: 0, label: '1kHz' },
  { frequency: 2000, gain: 0, label: '2kHz' },
  { frequency: 4000, gain: 0, label: '4kHz' },
  { frequency: 8000, gain: 0, label: '8kHz' },
  { frequency: 16000, gain: 0, label: '16kHz' },
];

const PRESETS = {
  flat: { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  bass: { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  treble: { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 2, 4, 5, 6, 6] },
  vocal: { name: 'Vocal', gains: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
  rock: { name: 'Rock', gains: [5, 4, 3, 1, -1, -1, 0, 2, 3, 4] },
  electronic: { name: 'Electronic', gains: [4, 3, 1, 0, -2, 2, 1, 1, 3, 4] },
  acoustic: { name: 'Acoustic', gains: [3, 3, 2, 1, 2, 2, 3, 4, 3, 2] },
};

export function Equalizer({ isEnabled, onToggle }: EqualizerProps) {
  const [bands, setBands] = useState<EqualizerBand[]>(DEFAULT_BANDS);
  const [selectedPreset, setSelectedPreset] = useState<string>('flat');

  // Load saved equalizer settings
  useEffect(() => {
    const savedBands = localStorage.getItem('equalizerBands');
    const savedPreset = localStorage.getItem('equalizerPreset');
    const savedEnabled = localStorage.getItem('equalizerEnabled');
    
    if (savedBands) {
      try {
        const parsed = JSON.parse(savedBands);
        setBands(parsed);
      } catch (error) {
        console.error('Error loading equalizer settings:', error);
      }
    }
    
    if (savedPreset) {
      setSelectedPreset(savedPreset);
    }
    
    if (savedEnabled !== null) {
      onToggle(savedEnabled === 'true');
    }
  }, []);

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem('equalizerBands', JSON.stringify(bands));
  }, [bands]);

  useEffect(() => {
    localStorage.setItem('equalizerPreset', selectedPreset);
  }, [selectedPreset]);

  useEffect(() => {
    localStorage.setItem('equalizerEnabled', isEnabled.toString());
  }, [isEnabled]);

  const handleBandChange = async (index: number, gain: number) => {
    const newBands = [...bands];
    newBands[index].gain = gain;
    setBands(newBands);
    
    // Send to backend
    try {
      await invoke('set_equalizer_band', { 
        frequency: newBands[index].frequency, 
        gain: gain 
      });
    } catch (error) {
      console.error('Failed to set equalizer band:', error);
    }
  };

  const handlePresetChange = async (presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = PRESETS[presetKey as keyof typeof PRESETS];
    
    const newBands = bands.map((band, index) => ({
      ...band,
      gain: preset.gains[index]
    }));
    
    setBands(newBands);
    
    // Send all bands to backend
    try {
      await invoke('set_equalizer_preset', { gains: preset.gains });
    } catch (error) {
      console.error('Failed to set equalizer preset:', error);
    }
  };

  const resetEqualizer = () => {
    handlePresetChange('flat');
  };

  return (
    <div className="w-full space-y-4">
      {/* Header with toggle and presets */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Equalizer</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">Enable</span>
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            disabled={!isEnabled}
            className="px-3 py-1 text-sm bg-muted rounded-md border-0 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {Object.entries(PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>{preset.name}</option>
            ))}
          </select>
          
          <button
            onClick={resetEqualizer}
            disabled={!isEnabled}
            className="px-3 py-1 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Frequency bands */}
      <div className="flex items-end justify-between gap-2 h-48 px-4 py-2 bg-black/50 rounded-lg">
        {bands.map((band, index) => (
          <div key={band.frequency} className="flex-1 flex flex-col items-center gap-2">
            {/* Gain value */}
            <span className="text-xs text-muted-foreground">
              {band.gain > 0 ? '+' : ''}{band.gain}dB
            </span>
            
            {/* Slider */}
            <div className="relative h-32 flex items-center">
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={band.gain}
                onChange={(e) => handleBandChange(index, Number(e.target.value))}
                disabled={!isEnabled}
                className="absolute w-32 h-2 -rotate-90 origin-center appearance-none bg-muted rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110"
                style={{
                  left: '-60px',
                  top: '50%',
                  transform: 'translateY(-50%) rotate(-90deg)'
                }}
              />
            </div>
            
            {/* Frequency label */}
            <span className="text-xs text-muted-foreground mt-2">
              {band.label}
            </span>
          </div>
        ))}
      </div>

      {/* Visual representation */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50"
          style={{
            transform: `scaleX(${isEnabled ? 1 : 0})`,
            transition: 'transform 0.3s ease'
          }}
        />
      </div>
    </div>
  );
}