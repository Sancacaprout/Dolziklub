"use client";
/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useState } from "react";
import { AlbumLookup, TrackLookup } from "@/components/music-assist";
import { type MusicCandidate } from "@/lib/music-matching";

export type AssistedEntry = { id: string; album_title: string | null; album_artist: string | null; cover_path: string | null };
export type AssistedReview = { review: string; rating: number; best_track: string | null; worst_track: string | null };
export type AssistedProposalPayload = { entryId: string; title: string; artist: string; file: File | null; match?: MusicCandidate | null };
export type AssistedReviewPayload = { entryId: string; review: string; rating: number; bestTrack: string; worstTrack: string; bestMatch?: MusicCandidate | null; worstMatch?: MusicCandidate | null };

const ratings = Array.from({ length: 6 }, (_, index) => index);

function isFilled(entry: AssistedEntry) { return Boolean(entry.album_title?.trim() && entry.album_artist?.trim()); }

export function ProposalAssistantCard({ entry, coverUrl, saving, onSave, onDelete }: { entry: AssistedEntry; coverUrl: string | null; saving: boolean; onSave: (payload: AssistedProposalPayload) => void; onDelete: (entryId: string) => void }) {
  const [title, setTitle] = useState(entry.album_title ?? "");
  const [artist, setArtist] = useState(entry.album_artist ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [match, setMatch] = useState<MusicCandidate | null | undefined>(undefined);
  const filled = isFilled(entry);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave({ entryId: entry.id, title, artist, file, match }); };
  return <article className="review-card proposal-card"><div className="review-card__album">{coverUrl ? <img src={coverUrl} alt="Pochette proposée" width={90} height={90} /> : <span className="proposal-card__placeholder">POC HETTE</span>}<span className="eyebrow">{filled ? "PROPOSITION MODIFIABLE" : "À PROPOSER"}</span><h3>{filled ? entry.album_title : "Tes choix, ton disque."}</h3><p>{filled ? "Tu peux corriger ou retirer cet album tant que son écoute n’a pas reçu de verdict." : "Renseigne l’album, l’artiste et, si tu veux, sa pochette."}</p></div><form className="review-form" onSubmit={submit}><label><span>Titre de l’album</span><input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de l’album" /></label><label><span>Artiste</span><input required maxLength={180} value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Nom de l’artiste" /></label><AlbumLookup title={title} artist={artist} selected={match ?? null} disabled={saving} onSelect={(candidate) => { setMatch(candidate); if (candidate) { setTitle(candidate.title); setArtist(candidate.artist); } }} /><label className="proposal-cover-field"><span>Pochette manuelle (facultative)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{match?.id && <p className="music-confirmation">Résultat choisi : <b>{match.title}</b> · {match.confidence === "high" ? "correspondance élevée" : "à vérifier avant d’enregistrer"}.</p>}<div className="proposal-actions"><button type="submit" className="button" disabled={saving}>{saving ? "Enregistrement…" : filled ? "Modifier mon album" : "Confirmer l’album"}</button>{filled && <button type="button" className="sheet-entry-action sheet-entry-action--delete" disabled={saving} onClick={() => { if (confirm("Retirer cet album de ta proposition ?")) onDelete(entry.id); }}>Supprimer l’album</button>}</div></form></article>;
}

export function ReviewAssistantCard({ entry, existing, coverUrl, saving, onSave }: { entry: AssistedEntry; existing?: AssistedReview; coverUrl: string | null; saving: boolean; onSave: (payload: AssistedReviewPayload) => void }) {
  const [review, setReview] = useState(existing?.review ?? "");
  const [rating, setRating] = useState(String(existing?.rating ?? ""));
  const [bestTrack, setBestTrack] = useState(existing?.best_track ?? "");
  const [worstTrack, setWorstTrack] = useState(existing?.worst_track ?? "");
  const [bestMatch, setBestMatch] = useState<MusicCandidate | null>(null);
  const [worstMatch, setWorstMatch] = useState<MusicCandidate | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave({ entryId: entry.id, review, rating: Number(rating), bestTrack, worstTrack, bestMatch, worstMatch }); };
  return <article className="review-card"><div className="review-card__album">{coverUrl && <img src={coverUrl} alt="Pochette de l’album" width={90} height={90} />}<span className="eyebrow">{existing ? "VERDICT ENREGISTRÉ" : "À RENDRE"}</span><h3>{entry.album_title}</h3><p>{entry.album_artist}</p></div><form className="review-form" onSubmit={submit}><label><span>Ton avis</span><textarea required maxLength={2000} value={review} onChange={(event) => setReview(event.target.value)} placeholder="Ton verdict, sans filtre." /></label><label><span>Ta note</span><select required value={rating} onChange={(event) => setRating(event.target.value)}><option value="" disabled>Choisir une note</option>{ratings.map((choice) => <option key={choice} value={choice}>{choice} / 5</option>)}</select></label><div className="review-form__tracks"><TrackLookup label="La pépite" title={bestTrack} artist={entry.album_artist ?? ""} albumTitle={entry.album_title ?? ""} selected={bestMatch} disabled={saving} onTitleChange={setBestTrack} onSelect={setBestMatch} /><TrackLookup label="Envoyé au goulag" title={worstTrack} artist={entry.album_artist ?? ""} albumTitle={entry.album_title ?? ""} selected={worstMatch} disabled={saving} onTitleChange={setWorstTrack} onSelect={setWorstMatch} /></div><button type="submit" className="button" disabled={saving}>{saving ? "Enregistrement…" : existing ? "Mettre à jour mon verdict" : "Enregistrer mon verdict"}</button></form></article>;
}
