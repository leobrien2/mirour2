"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

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

    // Trigger visual animation immediately, independent of network speed
    setAnimating(true);
    setTimeout(() => setAnimating(false), 350);

    try {
      await onToggle(productId);
    } catch (error) {
      // If the toggle fails, the UI will revert on the next prop update from the parent
      console.error("Failed to toggle favorite status:", error);
    }
  };

  // Increased touch targets slightly for better mobile usability
  const size = compact ? "w-8 h-8" : "w-10 h-10";
  const iconSize = compact ? "w-4 h-4" : "w-5 h-5";

  return (
    <button
      onClick={handleClick}
      aria-label={isSaved ? "Remove from favorites" : "Add to favorites"}
      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border transition-all active:scale-90 ${
        isSaved
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background/90 text-muted-foreground border-border/60 hover:border-primary/40"
      }`}
    >
      {" "}
      <Heart className={`w-3.5 h-3.5 ${isSaved ? "fill-current" : ""}`} />
    </button>
  );
}

