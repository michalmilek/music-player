import { Music } from "lucide-react";
import { Song } from "../types/music";
import { StarRating } from "./StarRating";

interface NowPlayingProps {
  currentSong: Song | null;
  currentArtwork: string | null;
  onSetRating?: (songPath: string, rating: number) => void;
}

export function NowPlaying({ currentSong, currentArtwork, onSetRating }: NowPlayingProps) {
  return (
    <div className="text-center mb-8">
      <div className="w-64 h-64 bg-muted rounded-lg overflow-hidden mx-auto mb-6">
        {currentArtwork ? (
          <img 
            src={currentArtwork} 
            alt="Album artwork"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Music className="w-32 h-32 text-muted-foreground" />
          </div>
        )}
      </div>
      <h2 className="text-2xl font-bold mb-2">
        {currentSong?.metadata?.title || currentSong?.name || 'No song playing'}
      </h2>
      {currentSong?.metadata?.artist && (
        <p className="text-lg text-muted-foreground mb-4">
          {currentSong.metadata.artist}
        </p>
      )}
      {currentSong && onSetRating && (
        <div className="flex justify-center">
          <StarRating
            rating={currentSong.rating || 0}
            onRatingChange={(rating) => onSetRating(currentSong.path, rating)}
            size="lg"
          />
        </div>
      )}
    </div>
  );
}