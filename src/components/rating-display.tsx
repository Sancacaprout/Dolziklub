export function RatingDisplay({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="rating rating--pending">En attente</span>;
  return <span className="rating" aria-label={`Note ${rating} sur 5`}>{rating.toFixed(1)} <small>/ 5</small></span>;
}
