import { Star } from "lucide-react";

export function ReviewStars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-deep" aria-label={`${rating} sur 5 étoiles`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={size} aria-hidden fill={index < rating ? "currentColor" : "none"} />
      ))}
    </span>
  );
}