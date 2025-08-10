import { Heart } from "lucide-react";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FavoriteButton({ 
  isFavorite, 
  onToggleFavorite, 
  size = "md",
  className = ""
}: FavoriteButtonProps) {
  const getSizeClasses = () => {
    switch (size) {
      case "sm": return "w-4 h-4";
      case "md": return "w-5 h-5";
      case "lg": return "w-6 h-6";
    }
  };

  const getButtonClasses = () => {
    const base = "transition-colors hover:scale-110 transform transition-transform";
    switch (size) {
      case "sm": return `${base} p-1`;
      case "md": return `${base} p-1.5`;
      case "lg": return `${base} p-2`;
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // Prevent triggering parent click events
        onToggleFavorite();
      }}
      className={`
        ${getButtonClasses()}
        rounded-full
        ${isFavorite 
          ? 'text-red-500 hover:text-red-600' 
          : 'text-gray-400 hover:text-red-400'
        }
        ${className}
      `}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart 
        className={`${getSizeClasses()} ${isFavorite ? 'fill-current' : ''}`}
      />
    </button>
  );
}