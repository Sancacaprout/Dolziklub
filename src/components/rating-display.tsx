export function RatingDisplay({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="rating rating--pending sheet-pending">EN ATTENTE</span>;
  return <span className="rating" aria-label={`Note ${rating} sur 5`}>{rating.toFixed(1).replace(".", ",")} <small>/ 5</small></span>;
}
