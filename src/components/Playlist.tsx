import { Song } from "../types/music";
import { Trash2, FolderSearch, FolderOpen, Download, GripVertical, Heart } from "lucide-react";
import { useState } from "react";
import { StarRating } from "./StarRating";
import { FavoriteButton } from "./FavoriteButton";

interface PlaylistProps {
  playlist: Song[];
  currentSong: Song | null;
  onSongSelect: (song: Song) => void;
  onClearPlaylist: () => void;
  onLoadMusic: () => void;
  onImportLibrary: () => void;
  onExportPlaylist: () => void;
  onReorderPlaylist: (fromIndex: number, toIndex: number) => void;
  onSetRating: (songPath: string, rating: number) => void;
  onToggleFavorite: (songPath: string) => void;
}

export function Playlist({
  playlist,
  currentSong,
  onSongSelect,
  onClearPlaylist,
  onLoadMusic,
  onImportLibrary,
  onExportPlaylist,
  onReorderPlaylist,
  onSetRating,
  onToggleFavorite,
}: PlaylistProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorderPlaylist(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const filteredPlaylist = showOnlyFavorites 
    ? playlist.filter(song => song.isFavorite) 
    : playlist;

  const favoriteCount = playlist.filter(song => song.isFavorite).length;

  return (
    <aside className="w-80 border-r p-4 overflow-y-auto">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Playlist {showOnlyFavorites ? `(${favoriteCount} favorites)` : `(${playlist.length} songs)`}
          </h2>
          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            disabled={favoriteCount === 0}
            className={`
              p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${showOnlyFavorites 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'text-gray-400 hover:text-red-400 hover:bg-red-50'
              }
            `}
            title={showOnlyFavorites ? "Show all songs" : "Show only favorites"}
          >
            <Heart className={`w-5 h-5 ${showOnlyFavorites ? 'fill-current' : ''}`} />
          </button>
        </div>
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
        {filteredPlaylist.map((song, filteredIndex) => {
          const originalIndex = playlist.findIndex(s => s.path === song.path);
          return (
          <div
            key={`${song.path}-${filteredIndex}`}
            draggable={!showOnlyFavorites}
            onDragStart={(e) => handleDragStart(e, originalIndex)}
            onDragOver={(e) => handleDragOver(e, originalIndex)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, originalIndex)}
            onDragEnd={handleDragEnd}
            className={`p-3 rounded-md transition-colors group relative ${
              draggedIndex === originalIndex 
                ? 'opacity-50 scale-95 bg-primary/10' 
                : dragOverIndex === originalIndex && draggedIndex !== null
                  ? 'border-2 border-primary border-dashed bg-primary/5'
                  : currentSong?.path === song.path
                    ? 'bg-accent text-accent-foreground cursor-pointer'
                    : 'hover:bg-muted cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div 
                  className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground text-sm w-6 text-center">
                  {song.metadata?.track_number || originalIndex + 1}
                </span>
              </div>
              <div 
                className="flex-1 min-w-0"
                onClick={() => onSongSelect(song)}
              >
                <div className="truncate font-medium">{song.name}</div>
                {song.metadata?.artist && (
                  <div className="text-sm text-muted-foreground truncate">
                    {song.metadata.artist}
                    {song.metadata.album && ` • ${song.metadata.album}`}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <StarRating
                    rating={song.rating || 0}
                    onRatingChange={(rating) => onSetRating(song.path, rating)}
                    size="sm"
                  />
                  <FavoriteButton
                    isFavorite={song.isFavorite || false}
                    onToggleFavorite={() => onToggleFavorite(song.path)}
                    size="sm"
                  />
                </div>
              </div>
              {song.metadata?.duration && (
                <span 
                  className="text-sm text-muted-foreground"
                  onClick={() => onSongSelect(song)}
                >
                  {formatTime(song.metadata.duration)}
                </span>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </aside>
  );
}