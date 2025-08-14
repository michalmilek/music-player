import { useState } from "react";
import { SmartPlaylist, Song, PlayHistoryEntry } from "../types/music";
import { SmartPlaylistEngine } from "../utils/smartPlaylistEngine";
import { SmartPlaylistCreator } from "./SmartPlaylistCreator";
import { 
  Wand2, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Eye, 
  EyeOff,
  Clock,
  Hash,
  X 
} from "lucide-react";

interface SmartPlaylistManagerProps {
  smartPlaylists: SmartPlaylist[];
  allSongs: Song[];
  playHistory: PlayHistoryEntry[];
  getSongRating: (path: string) => number;
  getSongFavorite: (path: string) => boolean;
  onSaveSmartPlaylist: (smartPlaylist: SmartPlaylist) => void;
  onDeleteSmartPlaylist: (playlistId: string) => void;
  onToggleSmartPlaylist: (playlistId: string) => void;
  onPlaySmartPlaylist: (songs: Song[]) => void;
  onClose: () => void;
}

export function SmartPlaylistManager({
  smartPlaylists,
  allSongs,
  playHistory,
  getSongRating,
  getSongFavorite,
  onSaveSmartPlaylist,
  onDeleteSmartPlaylist,
  onToggleSmartPlaylist,
  onPlaySmartPlaylist,
  onClose
}: SmartPlaylistManagerProps) {
  const [showCreator, setShowCreator] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<SmartPlaylist | null>(null);
  const [previewPlaylist, setPreviewPlaylist] = useState<SmartPlaylist | null>(null);
  const [previewSongs, setPreviewSongs] = useState<Song[]>([]);

  const handleCreateNew = () => {
    setEditingPlaylist(null);
    setShowCreator(true);
  };

  const handleEdit = (playlist: SmartPlaylist) => {
    setEditingPlaylist(playlist);
    setShowCreator(true);
  };

  const handleSave = (smartPlaylist: SmartPlaylist) => {
    onSaveSmartPlaylist(smartPlaylist);
    setShowCreator(false);
    setEditingPlaylist(null);
  };

  const handlePreview = (smartPlaylist: SmartPlaylist) => {
    const songs = SmartPlaylistEngine.evaluateSmartPlaylist(
      smartPlaylist,
      allSongs,
      playHistory,
      getSongRating,
      getSongFavorite
    );
    setPreviewPlaylist(smartPlaylist);
    setPreviewSongs(songs);
  };

  const handleCloseCreator = () => {
    setShowCreator(false);
    setEditingPlaylist(null);
  };

  const handleClosePreview = () => {
    setPreviewPlaylist(null);
    setPreviewSongs([]);
  };

  const getPlaylistStats = (playlist: SmartPlaylist) => {
    const songs = SmartPlaylistEngine.evaluateSmartPlaylist(
      playlist,
      allSongs,
      playHistory,
      getSongRating,
      getSongFavorite
    );
    
    const totalDuration = songs.reduce((acc, song) => acc + (song.metadata?.duration || 0), 0);
    
    return {
      songCount: songs.length,
      duration: totalDuration,
      songs
    };
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Smart Playlists
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your automatic playlists
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Smart Playlist
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {smartPlaylists.length === 0 ? (
            <div className="text-center py-12">
              <Wand2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Smart Playlists Yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first smart playlist to automatically organize your music
              </p>
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Smart Playlist
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {smartPlaylists.map((playlist) => {
                const stats = getPlaylistStats(playlist);
                
                return (
                  <div key={playlist.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-lg">{playlist.name}</h3>
                          <button
                            onClick={() => onToggleSmartPlaylist(playlist.id)}
                            className={`p-1 rounded-md transition-colors ${
                              playlist.isActive 
                                ? "text-green-600 hover:bg-green-50" 
                                : "text-gray-400 hover:bg-gray-50"
                            }`}
                            title={playlist.isActive ? "Active" : "Inactive"}
                          >
                            {playlist.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                        </div>
                        
                        {playlist.description && (
                          <p className="text-muted-foreground mb-3">{playlist.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <Hash className="w-4 h-4" />
                            {stats.songCount} songs
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(stats.duration)}
                          </span>
                          <span>Updated {formatDate(playlist.updatedAt)}</span>
                        </div>

                        {/* Rules Summary */}
                        <div className="text-sm">
                          <span className="font-medium">Rules: </span>
                          <span className="text-muted-foreground">
                            {playlist.logic === "and" ? "Match all" : "Match any"} of {playlist.rules.length} rule{playlist.rules.length !== 1 ? 's' : ''}
                          </span>
                          {playlist.limit && (
                            <span className="text-muted-foreground"> • Limited to {playlist.limit} songs</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handlePreview(playlist)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onPlaySmartPlaylist(stats.songs)}
                          disabled={stats.songCount === 0}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Play"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(playlist)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteSmartPlaylist(playlist.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Creator Modal */}
      {showCreator && (
        <SmartPlaylistCreator
          onSave={handleSave}
          onClose={handleCloseCreator}
          onPreview={handlePreview}
          existingPlaylist={editingPlaylist || undefined}
        />
      )}

      {/* Preview Modal */}
      {previewPlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-background border rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Preview: {previewPlaylist.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {previewSongs.length} songs match the criteria
                  </p>
                </div>
                <button
                  onClick={handleClosePreview}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {previewSongs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No songs match the current criteria
                </div>
              ) : (
                <div className="space-y-2">
                  {previewSongs.map((song, index) => (
                    <div key={song.path} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                      <span className="text-sm text-muted-foreground w-8">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{song.name}</div>
                        {song.metadata?.artist && (
                          <div className="text-sm text-muted-foreground truncate">
                            {song.metadata.artist}
                            {song.metadata.album && ` • ${song.metadata.album}`}
                          </div>
                        )}
                      </div>
                      {song.metadata?.duration && (
                        <span className="text-sm text-muted-foreground">
                          {Math.floor(song.metadata.duration / 60)}:{(Math.floor(song.metadata.duration % 60)).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t">
              <div className="flex justify-between">
                <button
                  onClick={handleClosePreview}
                  className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => onPlaySmartPlaylist(previewSongs)}
                  disabled={previewSongs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Play Playlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}