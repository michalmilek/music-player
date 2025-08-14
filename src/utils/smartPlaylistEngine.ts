import { 
  Song, 
  SmartPlaylist, 
  SmartPlaylistRule, 
  SmartPlaylistField, 
  SmartPlaylistOperator, 
  SmartPlaylistLogic,
  SmartPlaylistTimeUnit,
  PlayHistoryEntry 
} from "../types/music";

export class SmartPlaylistEngine {
  static evaluateSmartPlaylist(
    smartPlaylist: SmartPlaylist, 
    allSongs: Song[], 
    playHistory: PlayHistoryEntry[],
    getSongRating: (path: string) => number,
    getSongFavorite: (path: string) => boolean
  ): Song[] {
    if (!smartPlaylist.rules.length) return [];

    // Filter songs based on rules
    const matchingSongs = allSongs.filter(song => {
      const ruleResults = smartPlaylist.rules.map(rule => 
        this.evaluateRule(rule, song, playHistory, getSongRating, getSongFavorite)
      );

      // Apply logic (AND/OR)
      if (smartPlaylist.logic === SmartPlaylistLogic.And) {
        return ruleResults.every(result => result);
      } else {
        return ruleResults.some(result => result);
      }
    });

    // Sort results
    let sortedSongs = matchingSongs;
    if (smartPlaylist.sortBy) {
      sortedSongs = this.sortSongs(matchingSongs, smartPlaylist.sortBy, smartPlaylist.sortOrder || "asc", playHistory, getSongRating);
    }

    // Apply limit
    if (smartPlaylist.limit && smartPlaylist.limit > 0) {
      sortedSongs = sortedSongs.slice(0, smartPlaylist.limit);
    }

    return sortedSongs;
  }

  private static evaluateRule(
    rule: SmartPlaylistRule, 
    song: Song, 
    playHistory: PlayHistoryEntry[],
    getSongRating: (path: string) => number,
    getSongFavorite: (path: string) => boolean
  ): boolean {
    const fieldValue = this.getFieldValue(rule.field, song, playHistory, getSongRating, getSongFavorite);
    const ruleValue = rule.value;

    switch (rule.operator) {
      case SmartPlaylistOperator.Contains:
        return String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase());
      
      case SmartPlaylistOperator.NotContains:
        return !String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase());
      
      case SmartPlaylistOperator.Equals:
        return fieldValue === ruleValue;
      
      case SmartPlaylistOperator.NotEquals:
        return fieldValue !== ruleValue;
      
      case SmartPlaylistOperator.GreaterThan:
        return Number(fieldValue) > Number(ruleValue);
      
      case SmartPlaylistOperator.LessThan:
        return Number(fieldValue) < Number(ruleValue);
      
      case SmartPlaylistOperator.GreaterThanOrEqual:
        return Number(fieldValue) >= Number(ruleValue);
      
      case SmartPlaylistOperator.LessThanOrEqual:
        return Number(fieldValue) <= Number(ruleValue);
      
      case SmartPlaylistOperator.IsTrue:
        return Boolean(fieldValue) === true;
      
      case SmartPlaylistOperator.IsFalse:
        return Boolean(fieldValue) === false;
      
      case SmartPlaylistOperator.InLast:
        return this.isInTimeRange(fieldValue as string, Number(ruleValue), rule.timeUnit!);
      
      case SmartPlaylistOperator.NotInLast:
        return !this.isInTimeRange(fieldValue as string, Number(ruleValue), rule.timeUnit!);
      
      default:
        return false;
    }
  }

  private static getFieldValue(
    field: SmartPlaylistField, 
    song: Song, 
    playHistory: PlayHistoryEntry[],
    getSongRating: (path: string) => number,
    getSongFavorite: (path: string) => boolean
  ): any {
    switch (field) {
      case SmartPlaylistField.Title:
        return song.name;
      
      case SmartPlaylistField.Artist:
        return song.metadata?.artist || "";
      
      case SmartPlaylistField.Album:
        return song.metadata?.album || "";
      
      case SmartPlaylistField.Genre:
        return song.metadata?.genre || "";
      
      case SmartPlaylistField.Year:
        return song.metadata?.year || 0;
      
      case SmartPlaylistField.Duration:
        return song.metadata?.duration || 0;
      
      case SmartPlaylistField.Rating:
        return getSongRating(song.path);
      
      case SmartPlaylistField.IsFavorite:
        return getSongFavorite(song.path);
      
      case SmartPlaylistField.PlayCount:
        const historyEntry = playHistory.find(entry => entry.song.path === song.path);
        return historyEntry?.playCount || 0;
      
      case SmartPlaylistField.LastPlayed:
        const lastPlayEntry = playHistory.find(entry => entry.song.path === song.path);
        return lastPlayEntry?.playedAt || "";
      
      default:
        return "";
    }
  }

  private static isInTimeRange(dateString: string, value: number, unit: SmartPlaylistTimeUnit): boolean {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    let unitMs: number;
    switch (unit) {
      case SmartPlaylistTimeUnit.Days:
        unitMs = 24 * 60 * 60 * 1000;
        break;
      case SmartPlaylistTimeUnit.Weeks:
        unitMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case SmartPlaylistTimeUnit.Months:
        unitMs = 30 * 24 * 60 * 60 * 1000;
        break;
      case SmartPlaylistTimeUnit.Years:
        unitMs = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        return false;
    }
    
    return diffMs <= (value * unitMs);
  }

  private static sortSongs(
    songs: Song[], 
    sortBy: SmartPlaylistField, 
    sortOrder: "asc" | "desc",
    playHistory: PlayHistoryEntry[],
    getSongRating: (path: string) => number
  ): Song[] {
    return [...songs].sort((a, b) => {
      const aValue = this.getFieldValue(sortBy, a, playHistory, getSongRating, () => false);
      const bValue = this.getFieldValue(sortBy, b, playHistory, getSongRating, () => false);
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;
      
      return sortOrder === "desc" ? -comparison : comparison;
    });
  }

  // Helper methods for getting available options
  static getFieldOptions(): { value: SmartPlaylistField; label: string }[] {
    return [
      { value: SmartPlaylistField.Title, label: "Title" },
      { value: SmartPlaylistField.Artist, label: "Artist" },
      { value: SmartPlaylistField.Album, label: "Album" },
      { value: SmartPlaylistField.Genre, label: "Genre" },
      { value: SmartPlaylistField.Year, label: "Year" },
      { value: SmartPlaylistField.Duration, label: "Duration" },
      { value: SmartPlaylistField.Rating, label: "Rating" },
      { value: SmartPlaylistField.IsFavorite, label: "Is Favorite" },
      { value: SmartPlaylistField.PlayCount, label: "Play Count" },
      { value: SmartPlaylistField.LastPlayed, label: "Last Played" }
    ];
  }

  static getOperatorOptions(field: SmartPlaylistField): { value: SmartPlaylistOperator; label: string }[] {
    const textOperators = [
      { value: SmartPlaylistOperator.Contains, label: "contains" },
      { value: SmartPlaylistOperator.NotContains, label: "does not contain" },
      { value: SmartPlaylistOperator.Equals, label: "is" },
      { value: SmartPlaylistOperator.NotEquals, label: "is not" }
    ];

    const numberOperators = [
      { value: SmartPlaylistOperator.Equals, label: "is" },
      { value: SmartPlaylistOperator.NotEquals, label: "is not" },
      { value: SmartPlaylistOperator.GreaterThan, label: "is greater than" },
      { value: SmartPlaylistOperator.LessThan, label: "is less than" },
      { value: SmartPlaylistOperator.GreaterThanOrEqual, label: "is greater than or equal to" },
      { value: SmartPlaylistOperator.LessThanOrEqual, label: "is less than or equal to" }
    ];

    const booleanOperators = [
      { value: SmartPlaylistOperator.IsTrue, label: "is true" },
      { value: SmartPlaylistOperator.IsFalse, label: "is false" }
    ];

    const dateOperators = [
      { value: SmartPlaylistOperator.InLast, label: "in the last" },
      { value: SmartPlaylistOperator.NotInLast, label: "not in the last" }
    ];

    switch (field) {
      case SmartPlaylistField.Title:
      case SmartPlaylistField.Artist:
      case SmartPlaylistField.Album:
      case SmartPlaylistField.Genre:
        return textOperators;
      
      case SmartPlaylistField.Year:
      case SmartPlaylistField.Duration:
      case SmartPlaylistField.Rating:
      case SmartPlaylistField.PlayCount:
        return numberOperators;
      
      case SmartPlaylistField.IsFavorite:
        return booleanOperators;
      
      case SmartPlaylistField.LastPlayed:
        return dateOperators;
      
      default:
        return textOperators;
    }
  }

  static getTimeUnitOptions(): { value: SmartPlaylistTimeUnit; label: string }[] {
    return [
      { value: SmartPlaylistTimeUnit.Days, label: "days" },
      { value: SmartPlaylistTimeUnit.Weeks, label: "weeks" },
      { value: SmartPlaylistTimeUnit.Months, label: "months" },
      { value: SmartPlaylistTimeUnit.Years, label: "years" }
    ];
  }

  static generateSuggestedSmartPlaylists(): Partial<SmartPlaylist>[] {
    return [
      {
        name: "My Favorites",
        description: "All songs marked as favorites",
        rules: [{
          id: "1",
          field: SmartPlaylistField.IsFavorite,
          operator: SmartPlaylistOperator.IsTrue,
          value: true
        }],
        logic: SmartPlaylistLogic.And
      },
      {
        name: "Highly Rated",
        description: "Songs with 4 or 5 star ratings",
        rules: [{
          id: "1",
          field: SmartPlaylistField.Rating,
          operator: SmartPlaylistOperator.GreaterThanOrEqual,
          value: 4
        }],
        logic: SmartPlaylistLogic.And
      },
      {
        name: "Recently Added",
        description: "Songs added in the last 7 days",
        rules: [{
          id: "1",
          field: SmartPlaylistField.LastPlayed,
          operator: SmartPlaylistOperator.InLast,
          value: 7,
          timeUnit: SmartPlaylistTimeUnit.Days
        }],
        logic: SmartPlaylistLogic.And
      },
      {
        name: "Long Songs",
        description: "Songs longer than 5 minutes",
        rules: [{
          id: "1",
          field: SmartPlaylistField.Duration,
          operator: SmartPlaylistOperator.GreaterThan,
          value: 300
        }],
        logic: SmartPlaylistLogic.And
      },
      {
        name: "Unrated Songs",
        description: "Songs without ratings",
        rules: [{
          id: "1",
          field: SmartPlaylistField.Rating,
          operator: SmartPlaylistOperator.Equals,
          value: 0
        }],
        logic: SmartPlaylistLogic.And
      }
    ];
  }
}