export interface TrackMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  track_number: number | null;
  year: number | null;
  genre: string | null;
  duration: number;
  codec: string | null;
  sample_rate: number | null;
  channels: string | null;
  bits_per_sample: number | null;
  has_artwork: boolean;
}

export interface AlbumArtwork {
  data: string;
  mime_type: string;
}

export interface Song {
  path: string;
  name: string;
  metadata?: TrackMetadata;
  rating?: number; // 0-5 stars
  isFavorite?: boolean;
}

export interface PlayHistoryEntry {
  song: Song;
  playedAt: string;
  playCount: number;
}

export enum PlaybackMode {
  Linear = "linear",
  RepeatAll = "repeat-all", 
  RepeatOne = "repeat-one",
  Shuffle = "shuffle"
}

export enum SmartPlaylistField {
  Artist = "artist",
  Album = "album",
  Genre = "genre",
  Year = "year",
  Rating = "rating",
  Duration = "duration",
  IsFavorite = "isFavorite",
  PlayCount = "playCount",
  LastPlayed = "lastPlayed",
  Title = "title"
}

export enum SmartPlaylistOperator {
  Contains = "contains",
  NotContains = "notContains",
  Equals = "equals",
  NotEquals = "notEquals",
  GreaterThan = "greaterThan",
  LessThan = "lessThan",
  GreaterThanOrEqual = "greaterThanOrEqual",
  LessThanOrEqual = "lessThanOrEqual",
  IsTrue = "isTrue",
  IsFalse = "isFalse",
  InLast = "inLast",
  NotInLast = "notInLast"
}

export enum SmartPlaylistTimeUnit {
  Days = "days",
  Weeks = "weeks",
  Months = "months",
  Years = "years"
}

export enum SmartPlaylistLogic {
  And = "and",
  Or = "or"
}

export interface SmartPlaylistRule {
  id: string;
  field: SmartPlaylistField;
  operator: SmartPlaylistOperator;
  value: string | number | boolean;
  timeUnit?: SmartPlaylistTimeUnit;
}

export interface SmartPlaylist {
  id: string;
  name: string;
  description?: string;
  rules: SmartPlaylistRule[];
  logic: SmartPlaylistLogic;
  limit?: number;
  sortBy?: SmartPlaylistField;
  sortOrder?: "asc" | "desc";
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}