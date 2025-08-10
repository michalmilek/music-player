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