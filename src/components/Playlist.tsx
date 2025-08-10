import { Song } from "../types/music";
import { Trash2, FolderSearch, FolderOpen, Download } from "lucide-react";

interface PlaylistProps {
  playlist: Song[];
  currentSong: Song | null;
  onSongSelect: (song: Song) => void;
  onClearPlaylist: () => void;
  onLoadMusic: () => void;
  onImportLibrary: () => void;
  onExportPlaylist: () => void;
}

export function Playlist({
  playlist,
  currentSong,
  onSongSelect,
  onClearPlaylist,
  onLoadMusic,
  onImportLibrary,
  onExportPlaylist,
}: PlaylistProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <aside className="w-80 border-r p-4 overflow-y-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Playlist</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onClearPlaylist}
            disabled={playlist.length === 0}
            className="flex items-center gap-1.5 px-2 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
          <button
            onClick={onExportPlaylist}
            disabled={playlist.length === 0}
            className="flex items-center gap-1.5 px-2 py-1 text-sm border rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={onImportLibrary}
            className="flex items-center gap-1.5 px-2 py-1 text-sm border rounded-md hover:bg-muted transition-colors"
          >
            <FolderSearch className="w-3.5 h-3.5" />
            Import
          </button>
          <button
            onClick={onLoadMusic}
            className="flex items-center gap-1.5 px-2 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Add Files
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {playlist.map((song, index) => (
          <div
            key={index}
            onClick={() => onSongSelect(song)}
            className={`p-3 rounded-md cursor-pointer transition-colors ${
              currentSong?.path === song.path
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
  );
}