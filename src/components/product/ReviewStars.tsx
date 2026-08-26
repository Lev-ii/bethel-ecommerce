import { Star } from "lucide-react";

export function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-deep" aria-label={`${rating} sur 5 étoiles`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={15} aria-hidden fill={index < rating ? "currentColor" : "none"} />
      ))}
    </span>
  );
}