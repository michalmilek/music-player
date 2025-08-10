import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  FolderOpen,
  Music,
  Loader2,
  Check,
  X,
  FolderSearch,
  FileAudio
} from "lucide-react";

interface ScanProgress {
  current: number;
  total: number;
  current_file: string;
}

interface MusicFileInfo {
  path: string;
  name: string;
  metadata?: {
    title: string | null;
    artist: string | null;
    album: string | null;
    duration: number;
  };
}

interface MusicLibraryImportProps {
  onImport: (songs: MusicFileInfo[]) => void;
  onClose: () => void;
}

export function MusicLibraryImport({ onImport, onClose }: MusicLibraryImportProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scannedFiles, setScannedFiles] = useState<MusicFileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  const selectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Music Folder"
    });

    if (selected && typeof selected === 'string') {
      setCurrentFolder(selected);
      await scanFolder(selected);
    }
  };

  const scanFolder = async (folderPath: string) => {
    setIsScanning(true);
    setScanProgress(null);
    setScannedFiles([]);
    setSelectedFiles(new Set());

    try {
      // Listen for scan progress
      const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
        setScanProgress(event.payload);
      });

      // Scan the folder
      const paths = await invoke<string[]>("scan_music_folder", { 
        folderPath 
      });

      unlisten();

      if (paths.length > 0) {
        setIsLoadingMetadata(true);
        
        // Get metadata for all files
        const filesInfo = await invoke<MusicFileInfo[]>("get_music_files_metadata", {
          paths
        });

        setScannedFiles(filesInfo);
        // Select all files by default
        setSelectedFiles(new Set(filesInfo.map(f => f.path)));
        setIsLoadingMetadata(false);
      }
    } catch (error) {
      console.error("Failed to scan folder:", error);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const toggleFileSelection = (path: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(path)) {
      newSelection.delete(path);
    } else {
      newSelection.add(path);
    }
    setSelectedFiles(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === scannedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(scannedFiles.map(f => f.path)));
    }
  };

  const importSelected = () => {
    const filesToImport = scannedFiles.filter(f => selectedFiles.has(f.path));
    onImport(filesToImport);
  };

  const formatPath = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts.slice(-3).join(' / ');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FolderSearch className="w-5 h-5" />
                Import Music Library
              </h2>
              {currentFolder && (
                <p className="text-sm text-muted-foreground mt-1">
                  {currentFolder}
                </p>
              )}
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
          {!isScanning && scannedFiles.length === 0 && (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a folder to scan</h3>
              <p className="text-muted-foreground mb-6">
                Choose a folder containing your music files.<br />
                Supported formats: MP3, WAV, OGG, FLAC, M4A, AAC, OPUS, WMA
              </p>
              <button
                onClick={selectFolder}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <FolderOpen className="w-5 h-5" />
                Browse for Folder
              </button>
            </div>
          )}

          {isScanning && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">Scanning folder...</h3>
              {scanProgress && (
                <div className="max-w-md mx-auto">
                  <p className="text-muted-foreground mb-2">
                    {scanProgress.current} / {scanProgress.total} files
                  </p>
                  <div className="h-2 bg-muted rounded-lg overflow-hidden mb-2">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{
                        width: `${(scanProgress.current / scanProgress.total) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatPath(scanProgress.current_file)}
                  </p>
                </div>
              )}
            </div>
          )}

          {isLoadingMetadata && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">Loading metadata...</h3>
              <p className="text-muted-foreground">
                Reading track information from files
              </p>
            </div>
          )}

          {!isScanning && !isLoadingMetadata && scannedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-medium">
                    Found {scannedFiles.length} music files
                  </h3>
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectedFiles.size === scannedFiles.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <button
                  onClick={selectFolder}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  Scan Another Folder
                </button>
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto border rounded-lg p-2">
                {scannedFiles.map((file) => (
                  <div
                    key={file.path}
                    onClick={() => toggleFileSelection(file.path)}
                    className={`p-3 rounded-md cursor-pointer transition-colors flex items-center gap-3 ${
                      selectedFiles.has(file.path)
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {selectedFiles.has(file.path) ? (
                        <Check className="w-5 h-5 text-primary" />
                      ) : (
                        <FileAudio className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {file.metadata?.title || file.name}
                      </div>
                      {file.metadata?.artist && (
                        <div className="text-sm text-muted-foreground truncate">
                          {file.metadata.artist}
                          {file.metadata.album && ` • ${file.metadata.album}`}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground truncate">
                        {formatPath(file.path)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isScanning && !isLoadingMetadata && scannedFiles.length > 0 && (
          <div className="p-6 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.size} files selected
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={importSelected}
                  disabled={selectedFiles.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Music className="w-4 h-4" />
                  Import {selectedFiles.size} {selectedFiles.size === 1 ? 'File' : 'Files'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}