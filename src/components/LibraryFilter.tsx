import { useState, useMemo, useEffect } from "react";
import { Song } from "../types/music";
import { Filter, X, Search, Calendar, User, Disc } from "lucide-react";

interface LibraryFilterProps {
  playlist: Song[];
  onFilteredPlaylistChange: (filteredPlaylist: Song[]) => void;
}

interface FilterState {
  searchText: string;
  selectedArtist: string;
  selectedGenre: string;
  selectedYear: string;
}

export function LibraryFilter({ playlist, onFilteredPlaylistChange }: LibraryFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchText: "",
    selectedArtist: "",
    selectedGenre: "",
    selectedYear: ""
  });

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const artists = new Set<string>();
    const genres = new Set<string>();
    const years = new Set<string>();

    playlist.forEach(song => {
      if (song.metadata?.artist) {
        artists.add(song.metadata.artist);
      }
      if (song.metadata?.genre) {
        genres.add(song.metadata.genre);
      }
      if (song.metadata?.year) {
        years.add(song.metadata.year.toString());
      }
    });

    return {
      artists: Array.from(artists).sort(),
      genres: Array.from(genres).sort(),
      years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)) // newest first
    };
  }, [playlist]);

  // Apply filters to playlist
  const filteredPlaylist = useMemo(() => {
    let result = playlist;

    // Text search (searches in title, artist, album)
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      result = result.filter(song => 
        song.name.toLowerCase().includes(searchLower) ||
        song.metadata?.artist?.toLowerCase().includes(searchLower) ||
        song.metadata?.album?.toLowerCase().includes(searchLower)
      );
    }

    // Artist filter
    if (filters.selectedArtist) {
      result = result.filter(song => song.metadata?.artist === filters.selectedArtist);
    }

    // Genre filter
    if (filters.selectedGenre) {
      result = result.filter(song => song.metadata?.genre === filters.selectedGenre);
    }

    // Year filter
    if (filters.selectedYear) {
      result = result.filter(song => song.metadata?.year?.toString() === filters.selectedYear);
    }

    return result;
  }, [playlist, filters]);

  // Update parent component when filtered playlist changes
  useEffect(() => {
    onFilteredPlaylistChange(filteredPlaylist);
  }, [filteredPlaylist, onFilteredPlaylistChange]);

  // Reset filters when playlist changes (new songs added/removed)
  useEffect(() => {
    // Re-apply current filters to the new playlist
    onFilteredPlaylistChange(filteredPlaylist);
  }, [playlist]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      searchText: "",
      selectedArtist: "",
      selectedGenre: "",
      selectedYear: ""
    });
  };

  const hasActiveFilters = filters.searchText || filters.selectedArtist || filters.selectedGenre || filters.selectedYear;
  const activeFilterCount = [filters.searchText, filters.selectedArtist, filters.selectedGenre, filters.selectedYear]
    .filter(Boolean).length;

  return (
    <div className="border-b bg-muted/20">
      {/* Filter toggle button */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filter Library
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Filter controls */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search songs, artists, albums..."
              value={filters.searchText}
              onChange={(e) => updateFilter("searchText", e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Artist filter */}
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <User className="w-4 h-4" />
                Artist
              </label>
              <select
                value={filters.selectedArtist}
                onChange={(e) => updateFilter("selectedArtist", e.target.value)}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All artists</option>
                {filterOptions.artists.map(artist => (
                  <option key={artist} value={artist}>{artist}</option>
                ))}
              </select>
            </div>

            {/* Genre filter */}
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Disc className="w-4 h-4" />
                Genre
              </label>
              <select
                value={filters.selectedGenre}
                onChange={(e) => updateFilter("selectedGenre", e.target.value)}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All genres</option>
                {filterOptions.genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>

            {/* Year filter */}
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Year
              </label>
              <select
                value={filters.selectedYear}
                onChange={(e) => updateFilter("selectedYear", e.target.value)}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All years</option>
                {filterOptions.years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results summary */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredPlaylist.length} of {playlist.length} songs
            {hasActiveFilters && (
              <span> • {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}