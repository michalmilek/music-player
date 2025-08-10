import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  rating: number; // 0-5
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
}

export function StarRating({ 
  rating, 
  onRatingChange, 
  readonly = false, 
  size = "md",
  showCount = false 
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const getSizeClasses = () => {
    switch (size) {
      case "sm": return "w-3 h-3";
      case "md": return "w-4 h-4";
      case "lg": return "w-5 h-5";
    }
  };

  const getContainerClasses = () => {
    switch (size) {
      case "sm": return "gap-0.5";
      case "md": return "gap-1";
      case "lg": return "gap-1.5";
    }
  };

  const handleStarClick = (starRating: number) => {
    if (readonly || !onRatingChange) return;
    
    // If clicking on the same star, toggle between that rating and 0
    const newRating = rating === starRating ? 0 : starRating;
    onRatingChange(newRating);
  };

  const handleStarHover = (starRating: number) => {
    if (readonly) return;
    setHoverRating(starRating);
  };

  const handleMouseLeave = () => {
    if (readonly) return;
    setHoverRating(null);
  };

  const displayRating = hoverRating ?? rating;

  return (
    <div className={`flex items-center ${getContainerClasses()}`}>
      <div 
        className={`flex items-center ${getContainerClasses()}`}
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => handleStarHover(star)}
            className={`
              ${getSizeClasses()}
              transition-colors
              ${readonly 
                ? 'cursor-default' 
                : 'cursor-pointer hover:scale-110 transform transition-transform'
              }
              ${star <= displayRating 
                ? 'text-yellow-400 fill-current' 
                : 'text-gray-300 hover:text-yellow-300'
              }
            `}
            title={readonly ? `${rating} out of 5 stars` : `Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star className={getSizeClasses()} />
          </button>
        ))}
      </div>
      
      {showCount && rating > 0 && (
        <span className={`
          text-muted-foreground ml-2
          ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}
        `}>
          ({rating})
        </span>
      )}
    </div>
  );
}