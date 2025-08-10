import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Download, FileText, Music2, X, Check } from "lucide-react";
import { Song } from "../types/music";
import { generateM3U, generatePLS, generateXSPF, generateTXT } from "../utils/playlistExport";

interface PlaylistExportProps {
  playlist: Song[];
  onClose: () => void;
}

type ExportFormat = 'm3u' | 'pls' | 'xspf' | 'txt';

interface ExportOption {
  format: ExportFormat;
  name: string;
  description: string;
  extension: string;
  icon: React.ReactNode;
}

export function PlaylistExport({ playlist, onClose }: PlaylistExportProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('m3u');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const exportOptions: ExportOption[] = [
    {
      format: 'm3u',
      name: 'M3U Playlist',
      description: 'Standard playlist format supported by most media players',
      extension: 'm3u',
      icon: <Music2 className="w-5 h-5" />
    },
    {
      format: 'pls',
      name: 'PLS Playlist',
      description: 'Winamp playlist format with metadata support',
      extension: 'pls',
      icon: <Music2 className="w-5 h-5" />
    },
    {
      format: 'xspf',
      name: 'XSPF Playlist',
      description: 'XML-based format with rich metadata support',
      extension: 'xspf',
      icon: <FileText className="w-5 h-5" />
    },
    {
      format: 'txt',
      name: 'Text List',
      description: 'Simple human-readable text format',
      extension: 'txt',
      icon: <FileText className="w-5 h-5" />
    }
  ];

  const generateContent = (format: ExportFormat): string => {
    switch (format) {
      case 'm3u':
        return generateM3U(playlist);
      case 'pls':
        return generatePLS(playlist);
      case 'xspf':
        return generateXSPF(playlist);
      case 'txt':
        return generateTXT(playlist);
      default:
        return generateM3U(playlist);
    }
  };

  const handleExport = async () => {
    if (playlist.length === 0) return;

    setIsExporting(true);
    setExportSuccess(false);

    try {
      const selectedOption = exportOptions.find(opt => opt.format === selectedFormat);
      if (!selectedOption) return;

      const filePath = await save({
        filters: [{
          name: selectedOption.name,
          extensions: [selectedOption.extension]
        }],
        defaultPath: `playlist.${selectedOption.extension}`
      });

      if (filePath) {
        const content = generateContent(selectedFormat);
        await invoke("save_playlist_file", {
          path: filePath,
          content
        });

        setExportSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to export playlist:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const previewContent = () => {
    const content = generateContent(selectedFormat);
    const lines = content.split('\n');
    const previewLines = lines.slice(0, 10);
    if (lines.length > 10) {
      previewLines.push('...');
    }
    return previewLines.join('\n');
  };

  if (exportSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background border rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Export Successful!</h2>
            <p className="text-muted-foreground">
              Your playlist has been exported successfully.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Playlist
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Export {playlist.length} songs to various playlist formats
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Format Selection */}
            <div>
              <h3 className="font-medium mb-4">Choose Format</h3>
              <div className="space-y-3">
                {exportOptions.map((option) => (
                  <label
                    key={option.format}
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedFormat === option.format
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={option.format}
                      checked={selectedFormat === option.format}
                      onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                      className="mt-1"
                    />
                    <div className="flex-shrink-0 mt-0.5">
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{option.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Extension: .{option.extension}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <h3 className="font-medium mb-4">Preview</h3>
              <div className="border rounded-lg p-4 bg-muted/20">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap overflow-x-auto">
                  {previewContent()}
                </pre>
              </div>
              
              {/* Statistics */}
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Playlist Statistics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total songs:</span>
                    <span className="ml-1 font-medium">{playlist.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">With metadata:</span>
                    <span className="ml-1 font-medium">
                      {playlist.filter(s => s.metadata).length}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Total duration:</span>
                    <span className="ml-1 font-medium">
                      {(() => {
                        const totalSeconds = playlist.reduce((acc, song) => 
                          acc + (song.metadata?.duration || 0), 0
                        );
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        return hours > 0 
                          ? `${hours}h ${minutes}m`
                          : `${minutes}m`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Choose your preferred format and click export
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={playlist.length === 0 || isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export Playlist
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}