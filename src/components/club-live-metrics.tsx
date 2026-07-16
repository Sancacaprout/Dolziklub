type ClubLiveMetricsProps = {
  archivedAlbums: number;
  currentAlbums: number;
  indexedAlbums: number;
  reviews: number;
  average: number | null;
  members: number;
  variant?: "ticker" | "poster";
};

export function ClubLiveMetrics({
  archivedAlbums,
  currentAlbums,
  indexedAlbums,
  reviews,
  average,
  members,
  variant = "ticker",
}: ClubLiveMetricsProps) {
  if (variant === "poster") {
    return (
      <div className="poster-stats">
        <div><b>{archivedAlbums}</b><span>albums archivés</span></div>
        <div><b>{currentAlbums}</b><span>albums en cours</span></div>
        <div><b>{members}</b><span>membres identifiés</span></div>
        <div><b>{reviews}</b><span>verdicts rendus</span></div>
        <div><b>{average?.toFixed(1) ?? "—"}</b><span>moyenne du club</span></div>
      </div>
    );
  }

  return (
    <section className="ticker">
      <span>{indexedAlbums} ALBUMS INDEXÉS</span>
      <span>{reviews} VERDICTS RÉPERTORIÉS</span>
      <span>{members} PARTICIPANTS IDENTIFIÉS</span>
    </section>
  );
}