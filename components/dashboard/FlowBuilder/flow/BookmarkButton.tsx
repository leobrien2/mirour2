"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

interface BookmarkButtonProps {
  productId: string;
  isSaved: boolean;
  onToggle: (productId: string) => Promise<void>;
  compact?: boolean;
}

export function BookmarkButton({
  productId,
  isSaved,
  onToggle,
  compact = false,
}: BookmarkButtonProps) {
  const [animating, setAnimating] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAnimating(true);
    await onToggle(productId);
    setTimeout(() => setAnimating(false), 350);
  };

  const size = compact ? "w-7 h-7" : "w-9 h-9";
  const iconSize = compact ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      onClick={handleClick}
      aria-label={isSaved ? "Remove from saved" : "Save product"}
      className={`
        flex items-center justify-center rounded-full border transition-all duration-200
        active:scale-90 ${size}
        ${animating ? "scale-125" : "scale-100"}
        ${
          isSaved
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background/80 backdrop-blur-sm border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
        }
      `}
    >
      {isSaved ? (
        <BookmarkCheck className={iconSize} />
      ) : (
        <Bookmark className={iconSize} />
      )}
    </button>
  );
}
