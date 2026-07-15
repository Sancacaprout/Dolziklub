"use client";

import Link from "next/link";
import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { albums as archivedAlbums } from "@/data/albums";
import { members } from "@/data/members";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { normalizeMusicText } from "@/lib/music-matching";
import { RatingDisplay } from "@/components/rating-display";
import { MusicChoiceButton } from "@/components/music-player";
import { ReviewPreview } from "@/components/review-preview";
import { AlbumTitlePreview } from "@/components/album-title-preview";
import { ProposalAssistantCard, ReviewAssistantCard, type AssistedProposalPayload, type AssistedReviewPayload } from "@/components/music-selection-cards";
import { LiveDraws, StickyDrawShell } from "@/components/live-draws";
import { AdminDrawHistory } from "@/components/admin-draw-history";
import type { Album } from "@/types/album";

type Tab = "archive" | "selection" | "kouize" | "admin" | "history";
type SignedMember = { id: string; username: string; displayName: string };
type DrawEntry = { id: string; draw_number: number; position: number; proposed_by: string | null; listened_by: string | null; proposed_by_name: string | null; listened_by_name: string | null; album_title: string | null; album_artist: string | null; cover_path: string | null; cover_source_url?: string | null; youtube_music_url?: string | null };
type DrawMeta = { draw_number: number; participant_usernames: string[]; status: "draft" | "published" | "locked"; avoid_repeated_pairs: boolean };
type ReviewRecord = { id?: string; album_id: string; review_title: string | null; review: string; rating: number; best_track: string | null; worst_track: string | null; best_track_youtube_music_url?: string | null; best_track_youtube_url?: string | null; worst_track_youtube_music_url?: string | null; worst_track_youtube_url?: string | null };
type ArchivedReview = { album_id: string; review: string | null; rating: number | null; best_track: string | null; worst_track: string | null; is_modified: boolean };
type ReviewPayload = AssistedReviewPayload;
type ProposalPayload = AssistedProposalPayload;
type PublicKouizeProfile = { username: string; kouize: unknown };

const tabs: Array<{ id: Exclude<Tab, "admin">; label: string; hint: string }> = [
  { id: "archive", label: "Tirages", hint: "Les archives et les tirages actifs du club" },
  { id: "selection", label: "Sélection", hint: "Tes propositions et tes écoutes à rendre" },
  { id: "kouize", label: "Kouize", hint: "Les goûts et curiosités des membres" },
];
const adminTab = { id: "admin" as const, label: "Préparer les tirages", hint: "Administration des prochains tirages" };
const historyTab = { id: "history" as const, label: "Historique", hint: "Journal administratif des tirages" };
const roster = members.flatMap((member) => member.username ? [{ username: member.username, displayName: member.displayName }] : []);
const ratingChoices = Array.from({ length: 11 }, (_, index) => index / 2);
function isHalfStepRating(rating: number) {
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 && Number.isInteger(rating * 2);
}
const quizQuestions = [
  { key: "default_style", label: "DÉPART", question: "Ton univers sonore par défaut", prompt: "Le style qui revient naturellement dans tes écoutes." },
  { key: "dislikes", label: "NOPE", question: "Le son que tu zappes sans hésiter", prompt: "Ce qui a très peu de chances de te convaincre." },
  { key: "curious_about", label: "DÉTOUR", question: "Le territoire musical qui t’intrigue", prompt: "Le genre ou l’univers que tu veux mieux explorer." },
  { key: "first_hook", label: "DÉCLIC", question: "Ce qui te capte dès les premières secondes", prompt: "L’élément qui te fait tendre l’oreille en premier." },
];

function memberName(name: string | null) { if (!name) return "—"; return normalizedMember(name) === "thomas" ? "Toma" : `${name.slice(0, 1).toLocaleUpperCase()}${name.slice(1)}`; }
function value(input: string | null) { const text = input?.trim(); return !text || /^avis à compléter$/i.test(text) ? "—" : text; }
function memberProfileHref(name: string | null) { const key = normalizedMember(name); const clubMember = members.find((candidate) => [candidate.slug, candidate.username, candidate.displayName].some((value) => normalizedMember(value) === key)); return clubMember ? `/membres/${clubMember.slug}` : null; }
function MemberProfileLink({ name }: { name: string | null }) { const href = memberProfileHref(name); const label = memberName(name); return href ? <Link className="sheet-member sheet-member--link" href={href} aria-label={`Voir le profil de ${label}`}>{label}</Link> : <span className="sheet-member">{label}</span>; }
function coverUrl(path: string | null) { return path ? getSupabaseBrowserClient().storage.from("album-covers").getPublicUrl(path).data.publicUrl : null; }

function normalizedMember(value: string | null | undefined) { return value?.trim().toLocaleLowerCase() ?? ""; }
function duoMember(value: string | null | undefined) { const member = normalizedMember(value); return member === "thomas" ? "toma" : member; }
function duoKey(first: string | null | undefined, second: string | null | undefined) {
  const members = [duoMember(first), duoMember(second)].filter(Boolean).sort();
  return members.length === 2 ? members.join("|") : "";
}
function kouizeValue(input: unknown, key: string) { if (!input || typeof input !== "object" || Array.isArray(input)) return ""; const value = (input as Record<string, unknown>)[key]; return typeof value === "string" ? value.trim() : ""; }
function isAssignedToMember(entry: DrawEntry, member: SignedMember, role: "proposer" | "listener") {
  const id = role === "proposer" ? entry.proposed_by : entry.listened_by;
  const name = role === "proposer" ? entry.proposed_by_name : entry.listened_by_name;
  return id === member.id || [member.username, member.displayName].some((value) => normalizedMember(value) === normalizedMember(name));
}
function isEmptyAlbumSlot(entry: Pick<DrawEntry, "album_title" | "album_artist">) {
  const title = entry.album_title?.trim() ?? "";
  const artist = entry.album_artist?.trim() ?? "";
  return !title || !artist || /^album\s*[-–—]\s*artiste$/i.test(title);
}

function remapHistoricalRecords(records: ArchivedReview[]) {
  return records.flatMap((record) => {
    const match = /^archive-(\d+)$/.exec(record.album_id);
    if (!match) return [record];

    const archiveNumber = Number(match[1]);
    if (archiveNumber === 45) return [];
    if (archiveNumber >= 27 && archiveNumber <= 44) {
      return [{ ...record, album_id: `archive-${archiveNumber + 1}` }];
    }
    return [record];
  });
}

function storageArchiveRecordId(albumId: string) {
  const match = /^archive-(\d+)$/.exec(albumId);
  if (!match) return albumId;

  const archiveNumber = Number(match[1]);
  if (archiveNumber >= 28 && archiveNumber <= 45) return `archive-${archiveNumber - 1}`;
  return albumId;
}

function isHistoricalListener(album: Album, member: SignedMember) {
  return [member.username, member.displayName].some((name) => normalizedMember(name) === normalizedMember(album.listenedBy));
}
function archiveForEntry(entry: Pick<DrawEntry, "album_title" | "album_artist">) { return archivedAlbums.find((album) => normalizeMusicText(album.title) === normalizeMusicText(entry.album_title ?? "") && normalizeMusicText(album.artist) === normalizeMusicText(entry.album_artist ?? "")); }
function entryCoverUrl(entry: DrawEntry) { return coverUrl(entry.cover_path) ?? entry.cover_source_url ?? archiveForEntry(entry)?.cover ?? null; }

function MemberSelect({ value, onChange, label, options = roster, disabled = false }: { value: string | null; onChange: (next: string) => void; label: string; options?: typeof roster; disabled?: boolean }) {
  return <select value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label={label}><option value="">—</option>{options.map((member) => <option key={member.username} value={member.username}>{member.displayName}</option>)}</select>;
}

function HistoricalReviewRow({ album, record, editable, saving, onSave }: { album: Album; record?: ArchivedReview; editable: boolean; saving: boolean; onSave: (payload: Omit<ArchivedReview, "is_modified">) => void }) {
  const [review, setReview] = useState(record?.review ?? album.shortReview ?? "");
  const [rating, setRating] = useState(record?.rating?.toString() ?? album.rating?.toString() ?? "");
  const [bestTrack, setBestTrack] = useState(record?.best_track ?? album.bestTrack.title ?? "");
  const [worstTrack, setWorstTrack] = useState(record?.worst_track ?? album.worstTrack.title ?? "");
  const hasOverride = record?.is_modified === true;
  const renderedReview = hasOverride ? record?.review : album.shortReview;
  const renderedRating = hasOverride ? record?.rating : album.rating;
  const renderedBestTrack = hasOverride ? record?.best_track : album.bestTrack.title;
  const renderedWorstTrack = hasOverride ? record?.worst_track : album.worstTrack.title;
  const save = () => onSave({ album_id: album.id, review: review.trim() || null, rating: rating === "" ? null : Number(rating), best_track: bestTrack.trim() || null, worst_track: worstTrack.trim() || null });
  return <tr>
    <td><span className="sheet-album-link"><AlbumTitlePreview href={`/albums/${album.slug}`} title={album.title} artist={album.artist} cover={album.cover} label={`Archive #${album.id.replace("archive-", "")}`} /><span>{album.artist}</span></span></td>
    <td><MemberProfileLink name={album.proposedBy} /></td>
    <td><MemberProfileLink name={album.listenedBy} /></td>
    {editable ? <td className="sheet-review"><textarea className="sheet-inline-textarea" value={review} onChange={(event) => setReview(event.target.value)} maxLength={2000} aria-label={`Avis sur ${album.title}`} /></td> : <td className="sheet-review"><ReviewPreview review={renderedReview} /></td>}
    {editable ? <td><select className="sheet-inline-select" value={rating} onChange={(event) => setRating(event.target.value)} aria-label={`Note sur ${album.title}`}><option value="">En attente</option>{ratingChoices.map((choice) => <option key={choice} value={choice}>{String(choice).replace(".", ",")} / 5</option>)}</select></td> : <td>{renderedRating === null || renderedRating === undefined ? <span className="sheet-pending">En attente</span> : <RatingDisplay rating={renderedRating} />}</td>}
    {editable ? <td><input className="sheet-inline-input" value={bestTrack} onChange={(event) => setBestTrack(event.target.value)} maxLength={160} placeholder="Best track" aria-label={`Best track de ${album.title}`} /></td> : <td>{renderedBestTrack ? <MusicChoiceButton className="sheet-track-link sheet-track-link--best" title={renderedBestTrack} artist={album.artist} sourceUrl={`https://music.youtube.com/search?q=${encodeURIComponent(`${album.artist} ${renderedBestTrack}`)}`} externalUrl={`https://music.youtube.com/search?q=${encodeURIComponent(`${album.artist} ${renderedBestTrack}`)}`}>{renderedBestTrack}<span>↗</span></MusicChoiceButton> : <span className="sheet-track-empty">—</span>}</td>}
    {editable ? <td><div className="sheet-inline-save"><input className="sheet-inline-input" value={worstTrack} onChange={(event) => setWorstTrack(event.target.value)} maxLength={160} placeholder="Worst track" aria-label={`Worst track de ${album.title}`} /><button type="button" className="sheet-entry-action" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button></div></td> : <td>{renderedWorstTrack ? <MusicChoiceButton className="sheet-track-link sheet-track-link--worst" title={renderedWorstTrack} artist={album.artist} sourceUrl={`https://music.youtube.com/search?q=${encodeURIComponent(`${album.artist} ${renderedWorstTrack}`)}`} externalUrl={`https://music.youtube.com/search?q=${encodeURIComponent(`${album.artist} ${renderedWorstTrack}`)}`}>{renderedWorstTrack}<span>↗</span></MusicChoiceButton> : <span className="sheet-track-empty">—</span>}</td>}
  </tr>;
}

function HistoricalDraws({ albums }: { albums: Album[] }) {
  const configured = isSupabaseConfigured();
  const [member, setMember] = useState<SignedMember | null>(null);
  const [records, setRecords] = useState<ArchivedReview[]>([]);
  const [editingDraw, setEditingDraw] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const loadRecords = useCallback(async () => {
    if (!configured) return;
    const { data } = await getSupabaseBrowserClient().from("archived_album_reviews").select("album_id, review, rating, best_track, worst_track, is_modified");
    setRecords(remapHistoricalRecords((data ?? []) as ArchivedReview[]));
  }, [configured]);
  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const syncMember = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setMember(null); return; }
      const { data: profile } = await supabase.from("member_profiles").select("username, display_name").eq("id", data.user.id).maybeSingle();
      if (!profile) { setMember(null); return; }
      setMember({ id: data.user.id, username: profile.username, displayName: profile.display_name });
    };
    const timer = setTimeout(() => { void syncMember(); void loadRecords(); }, 0);
    const { data: listener } = supabase.auth.onAuthStateChange(() => void syncMember());
    return () => { clearTimeout(timer); listener.subscription.unsubscribe(); };
  }, [configured, loadRecords]);
  const saveRecord = async (record: Omit<ArchivedReview, "is_modified">) => {
    if (!member || !Number.isFinite(record.rating ?? 0) && record.rating !== null) return;
    setSavingId(record.album_id); setMessage("");
    const storageAlbumId = storageArchiveRecordId(record.album_id);
    const { error } = await getSupabaseBrowserClient().from("archived_album_reviews").update({ review: record.review, rating: record.rating, best_track: record.best_track, worst_track: record.worst_track, is_modified: true }).eq("album_id", storageAlbumId);
    setSavingId(null);
    if (error) setMessage("La modification n'a pas pu être enregistrée.");
    else { setMessage("Tes modifications sont enregistrées dans le tirage."); await loadRecords(); }
  };
  const ordered = [...albums].sort((a, b) => Number(a.id.replace("archive-", "")) - Number(b.id.replace("archive-", "")));
  const placeholder = (id: string, proposedBy: string, listenedBy: string): Album => ({ id, slug: id, title: "Album – Artiste", artist: "", cover: null, releaseYear: null, origin: null, language: null, genres: [], projectType: null, proposedBy, listenedBy, rating: null, shortReview: "Avis à compléter", detailedReview: null, bestTrack: { title: null, url: null }, worstTrack: { title: null, url: null }, albumUrl: null, artistDescription: null, albumDescription: null, status: "pending" });
  const inRange = (from: number, to: number) => ordered.filter((album) => { const position = Number(album.id.replace("archive-", "")); return position >= from && position <= to; });
  const groups = [{ draw: 1, albums: inRange(1, 10), isCurrent: false }, { draw: 2, albums: inRange(11, 19), isCurrent: false }, { draw: 3, albums: inRange(20, 28), isCurrent: false }, { draw: 4, albums: inRange(29, 36), isCurrent: false }, { draw: 5, albums: inRange(37, 45), isCurrent: false }, ...(!configured ? [{ draw: 6, albums: [placeholder("pending-yuna-enzo", "Yuna", "Enzo"), ...inRange(46, 46), placeholder("pending-enzo-motem", "Enzo", "Motem"), ...inRange(47, 49), placeholder("pending-chacha-bono", "Chacha", "Bono"), placeholder("pending-bono-chacha", "Bono", "Chacha")], isCurrent: true }] : [])];
  const recordMap = new Map(records.map((record) => [record.album_id, record]));
  return <>{message && <p className="selection-message" role="status">{message}</p>}{[...groups].reverse().map(({ draw, albums: group, isCurrent }) => {
    const canEditDraw = Boolean(member && group.some((album) => album.id.startsWith("archive-") && isHistoricalListener(album, member)));
    const editing = editingDraw === draw;
    const rows = group.map((album) => {
      const record = recordMap.get(album.id);
      const recordKey = `${album.id}:${record?.is_modified ?? false}:${record?.review ?? ""}:${record?.rating ?? ""}:${record?.best_track ?? ""}:${record?.worst_track ?? ""}`;
      return <HistoricalReviewRow key={recordKey} album={album} record={record} editable={Boolean(editing && member && album.id.startsWith("archive-") && isHistoricalListener(album, member))} saving={savingId === album.id} onSave={(nextRecord) => void saveRecord(nextRecord)} />;
    });
    return <StickyDrawShell key={draw} heading={<div className="draw-heading"><span className="eyebrow">TIRAGE {String(draw).padStart(2, "0")}{isCurrent ? " · EN COURS" : ""}</span><span>{isCurrent ? `${group.length} emplacements en cours` : `${group.length} albums classés`}</span>{canEditDraw && <button className="sheet-entry-action" type="button" onClick={() => setEditingDraw(editing ? null : draw)}>{editing ? "Terminer l’édition" : isCurrent ? "Rendre ou modifier mon avis" : "Modifier mes notes"}</button>}</div>}>{rows}</StickyDrawShell>;
    return <section className={`draw-section${isCurrent ? " draw-section--current" : ""}`} key={draw}><div className="draw-heading"><span className="eyebrow">TIRAGE {String(draw).padStart(2, "0")}{isCurrent ? " · EN COURS" : ""}</span><span>{isCurrent ? `${group.length} emplacements en cours` : `${group.length} albums classés`}</span>{canEditDraw && <button className="sheet-entry-action" type="button" onClick={() => setEditingDraw(editing ? null : draw)}>{editing ? "Terminer l'édition" : isCurrent ? "Rendre ou modifier mon avis" : "Modifier mes notes"}</button>}</div><div className="sheet-scroll"><table className="sheet-table"><thead><tr><th>Album · Artiste</th><th>Proposé par</th><th>Écouté par</th><th>Avis</th><th>Note</th><th>Best track</th><th>Worst track</th></tr></thead><tbody>{group.map((album) => { const record = recordMap.get(album.id); const recordKey = `${album.id}:${record?.is_modified ?? false}:${record?.review ?? ""}:${record?.rating ?? ""}:${record?.best_track ?? ""}:${record?.worst_track ?? ""}`; return <HistoricalReviewRow key={recordKey} album={album} record={record} editable={Boolean(editing && member && album.id.startsWith("archive-") && isHistoricalListener(album, member))} saving={savingId === album.id} onSave={(nextRecord) => void saveRecord(nextRecord)} />; })}</tbody></table></div></section>;
  })}</>;
}

function LegacyLiveDraws({ entries, reviews, visibleDraws, member, onOpenProposal, onOpenReview }: { entries: DrawEntry[]; reviews: ReviewRecord[]; visibleDraws: DrawMeta[]; member: SignedMember | null; onOpenProposal: (id: string) => void; onOpenReview: (id: string) => void }) {
  const draws = new Map<number, DrawEntry[]>();
  const reviewMap = new Map(reviews.map((review) => [review.album_id, review]));
  const visibleDrawNumbers = new Set(visibleDraws.map((draw) => draw.draw_number));
  entries.filter((entry) => visibleDrawNumbers.has(entry.draw_number)).forEach((entry) => draws.set(entry.draw_number, [...(draws.get(entry.draw_number) ?? []), entry]));
  return <>{[...draws.entries()].sort(([first], [second]) => second - first).map(([drawNumber, rows]) => {
    const draw = visibleDraws.find((candidate) => candidate.draw_number === drawNumber);
    return <section className="draw-section draw-section--live" key={drawNumber}><div className="draw-heading"><span className="eyebrow">TIRAGE {String(drawNumber).padStart(2, "0")} · {draw?.status === "locked" ? "ARCHIVÉ" : "EN COURS"}</span><span>{rows.length} emplacement{rows.length > 1 ? "s" : ""}</span></div><div className="sheet-scroll"><table className="sheet-table"><thead><tr><th>Album · Artiste</th><th>Proposé par</th><th>Écouté par</th><th>Avis</th><th>Note</th><th>Best track</th><th>Worst track</th></tr></thead><tbody>{rows.sort((a, b) => a.position - b.position).map((entry) => {
      const review = reviewMap.get(entry.id);
      const canPropose = member ? isAssignedToMember(entry, member, "proposer") && isEmptyAlbumSlot(entry) && draw?.status === "published" : false;
      const canReview = member ? isAssignedToMember(entry, member, "listener") && !isEmptyAlbumSlot(entry) && draw?.status === "published" : false;
      return <tr className={(canPropose || canReview) ? "sheet-row--action" : ""} key={entry.id} onClick={() => canPropose ? onOpenProposal(entry.id) : canReview ? onOpenReview(entry.id) : undefined}><td>{entry.album_title ? <span className="sheet-album-link"><b>{entry.album_title}</b><span>{entry.album_artist}</span></span> : <span className="sheet-placeholder-album">Album – Artiste</span>}</td><td><span className="sheet-member">{memberName(entry.proposed_by_name)}</span></td><td><span className="sheet-member">{memberName(entry.listened_by_name)}</span></td><td className="sheet-review"><ReviewPreview title={review?.review_title} review={review?.review} /></td><td>{review ? <RatingDisplay rating={review.rating} /> : <span className="sheet-pending">En attente</span>}</td><td>{review?.best_track ? <a className="sheet-track-link sheet-track-link--best" href={`https://music.youtube.com/search?q=${encodeURIComponent(`${entry.album_artist} ${review.best_track}`)}`} target="_blank" rel="noreferrer">{review.best_track}<span>↗</span></a> : <span className="sheet-track-empty">—</span>}</td><td>{review?.worst_track ? <a className="sheet-track-link sheet-track-link--worst" href={`https://music.youtube.com/search?q=${encodeURIComponent(`${entry.album_artist} ${review.worst_track}`)}`} target="_blank" rel="noreferrer">{review.worst_track}<span>↗</span></a> : <span className="sheet-track-empty">—</span>}</td></tr>;
    })}</tbody></table></div></section>;
  })}</>;
}
function LegacyProposalCard({ entry, saving, onSave, onDelete }: { entry: DrawEntry; saving: boolean; onSave: (payload: ProposalPayload) => void; onDelete: (entryId: string) => void }) {
  const [title, setTitle] = useState(entry.album_title ?? "");
  const [artist, setArtist] = useState(entry.album_artist ?? "");
  const [file, setFile] = useState<File | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave({ entryId: entry.id, title, artist, file }); };
  const isFilled = !isEmptyAlbumSlot(entry);
  return <article className="review-card proposal-card"><div className="review-card__album">{coverUrl(entry.cover_path) ? <Image unoptimized src={coverUrl(entry.cover_path)!} alt="Pochette proposée" width={90} height={90} /> : <span className="proposal-card__placeholder">POC HETTE</span>}<span className="eyebrow">{isFilled ? "PROPOSITION MODIFIABLE" : "À PROPOSER"}</span><h3>{isFilled ? entry.album_title : "Tes choix, ton disque."}</h3><p>{isFilled ? "Tu peux corriger ou retirer cet album tant que son écoute n’a pas reçu de verdict." : "Renseigne l’album, l’artiste et, si tu veux, sa pochette."}</p></div><form className="review-form" onSubmit={submit}><label><span>Titre de l’album</span><input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de l’album" /></label><label><span>Artiste</span><input required maxLength={180} value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Nom de l’artiste" /></label><label className="proposal-cover-field"><span>Pochette (facultative)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><div className="proposal-actions"><button type="submit" className="button" disabled={saving}>{saving ? "Enregistrement…" : isFilled ? "Modifier mon album" : "Enregistrer mon album"}</button>{isFilled && <button type="button" className="sheet-entry-action sheet-entry-action--delete" disabled={saving} onClick={() => { if (confirm("Retirer cet album de ta proposition ?")) onDelete(entry.id); }}>Supprimer l’album</button>}</div></form></article>;
}

function LegacyReviewCard({ entry, existing, saving, onSave }: { entry: DrawEntry; existing?: ReviewRecord; saving: boolean; onSave: (payload: ReviewPayload) => void }) {
  const [review, setReview] = useState(existing?.review ?? ""); const [rating, setRating] = useState(String(existing?.rating ?? "")); const [bestTrack, setBestTrack] = useState(existing?.best_track ?? ""); const [worstTrack, setWorstTrack] = useState(existing?.worst_track ?? "");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave({ entryId: entry.id, review, rating: Number(rating), bestTrack, worstTrack }); };
  return <article className="review-card"><div className="review-card__album">{coverUrl(entry.cover_path) && <Image unoptimized src={coverUrl(entry.cover_path)!} alt="Pochette de l’album" width={90} height={90} />}<span className="eyebrow">{existing ? "VERDICT ENREGISTRÉ" : "À RENDRE"}</span><h3>{entry.album_title}</h3><p>{entry.album_artist}</p></div><form className="review-form" onSubmit={submit}><label><span>Ton avis</span><textarea required maxLength={2000} value={review} onChange={(event) => setReview(event.target.value)} placeholder="Ton verdict, sans filtre." /></label><label><span>Ta note</span><select required value={rating} onChange={(event) => setRating(event.target.value)}><option value="" disabled>Choisir une note</option>{ratingChoices.map((choice) => <option key={choice} value={choice}>{String(choice).replace(".", ",")} / 5</option>)}</select></label><div className="review-form__tracks"><label><span>Best track</span><input maxLength={160} value={bestTrack} onChange={(event) => setBestTrack(event.target.value)} placeholder="Ton meilleur morceau" /></label><label><span>Worst track</span><input maxLength={160} value={worstTrack} onChange={(event) => setWorstTrack(event.target.value)} placeholder="Le morceau le moins convaincant" /></label></div><button type="submit" className="button" disabled={saving}>{saving ? "Enregistrement…" : existing ? "Mettre à jour mon verdict" : "Enregistrer mon verdict"}</button></form></article>;
}

const ProposalCard = ({ entry, saving, onSave, onDelete }: { entry: DrawEntry; saving: boolean; onSave: (payload: ProposalPayload) => void; onDelete: (entryId: string) => void }) => <ProposalAssistantCard entry={entry} coverUrl={entryCoverUrl(entry)} saving={saving} onSave={onSave} onDelete={onDelete} />;
const ReviewCard = ({ entry, existing, saving, onSave, onReset }: { entry: DrawEntry; existing?: ReviewRecord; saving: boolean; onSave: (payload: ReviewPayload) => void; onReset: (entryId: string) => void }) => <ReviewAssistantCard entry={entry} existing={existing} coverUrl={entryCoverUrl(entry)} saving={saving} onSave={onSave} onReset={onReset} />;
void LegacyProposalCard;
void LegacyReviewCard;

function HistoricalPendingReviews({ albums, member }: { albums: Album[]; member: SignedMember | null }) {
  const configured = isSupabaseConfigured();
  const [records, setRecords] = useState<ArchivedReview[]>([]);
  const [activeEntries, setActiveEntries] = useState<Array<Pick<DrawEntry, "album_title" | "album_artist">>>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const loadRecords = useCallback(async () => {
    if (!configured) return;
    const [reviewResult, entryResult] = await Promise.all([
      getSupabaseBrowserClient().from("archived_album_reviews").select("album_id, review, rating, best_track, worst_track, is_modified"),
      getSupabaseBrowserClient().from("club_draw_entries").select("album_title, album_artist"),
    ]);
    setRecords((reviewResult.data ?? []) as ArchivedReview[]);
    setActiveEntries((entryResult.data ?? []) as Array<Pick<DrawEntry, "album_title" | "album_artist">>);
  }, [configured]);
  useEffect(() => { const timer = window.setTimeout(() => void loadRecords(), 0); return () => window.clearTimeout(timer); }, [loadRecords]);
  if (!member) return null;
  const recordMap = new Map(records.map((record) => [record.album_id, record]));
  const pending = albums.filter((album) => {
    if (!isHistoricalListener(album, member)) return false;
    if (activeEntries.some((entry) => !isEmptyAlbumSlot(entry) && normalizedMember(entry.album_title) === normalizedMember(album.title) && normalizedMember(entry.album_artist) === normalizedMember(album.artist))) return false;
    const record = recordMap.get(album.id);
    const effectiveRating = record?.is_modified ? record.rating : album.rating;
    return effectiveRating === null;
  });
  const save = async ({ entryId, review, rating, bestTrack, worstTrack }: ReviewPayload) => {
    if (!configured || !review.trim() || !isHalfStepRating(rating) || rating < 0 || rating > 5) return;
    setSavingId(entryId); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("archived_album_reviews").update({ review: review.trim(), rating, best_track: bestTrack.trim() || null, worst_track: worstTrack.trim() || null }).eq("album_id", entryId);
    setSavingId(null);
    if (error) setMessage(error.message);
    else { setMessage("Verdict enregistré dans le tirage."); await loadRecords(); }
  };
  return <section className="review-workspace historical-pending-workspace"><div className="review-workspace__heading"><div><p className="eyebrow">VERDICTS EN ATTENTE</p><h2>Les albums plus anciens que je dois <em>encore rendre.</em></h2><p>Chaque écoute sans note reste ici jusqu’à ce que tu enregistres ton verdict.</p></div><span className="review-counter">{pending.length} écoute{pending.length > 1 ? "s" : ""}</span></div>{message && <p className="selection-message" role="status">{message}</p>}<div className="review-queue">{pending.length ? pending.map((album) => {
    const entry: DrawEntry = { id: album.id, draw_number: Math.ceil(Number(album.id.replace("archive-", "")) / 9), position: Number(album.id.replace("archive-", "")), proposed_by: null, listened_by: null, proposed_by_name: album.proposedBy, listened_by_name: album.listenedBy, album_title: album.title, album_artist: album.artist, cover_path: null };
    return <ReviewAssistantCard key={album.id} entry={entry} coverUrl={album.cover} saving={savingId === album.id} onSave={(payload) => void save(payload)} onReset={() => undefined} />;
  }) : <div className="review-workspace__empty"><p>Aucun verdict historique en attente pour l’instant.</p></div>}</div></section>;
}

function SelectionWorkspace({ albums, entries, draws, member, reviews, focusedProposal, focusedReview, savingId, onProposal, onDeleteProposal, onReview, onResetReview }: { albums: Album[]; entries: DrawEntry[]; draws: DrawMeta[]; member: SignedMember | null; reviews: ReviewRecord[]; focusedProposal: string | null; focusedReview: string | null; savingId: string | null; onProposal: (payload: ProposalPayload) => void; onDeleteProposal: (entryId: string) => void; onReview: (payload: ReviewPayload) => void; onResetReview: (entryId: string) => void }) {
  const availableDraws = new Set(draws.filter((draw) => draw.status === "published" || draw.status === "locked").map((draw) => draw.draw_number));
  const currentEntries = entries.filter((entry) => availableDraws.has(entry.draw_number));
  const reviewMap = new Map(reviews.map((review) => [review.album_id, review]));
  const proposals = member ? currentEntries.filter((entry) => isAssignedToMember(entry, member, "proposer") && !reviewMap.has(entry.id)) : [];
  const listens = member ? currentEntries.filter((entry) => isAssignedToMember(entry, member, "listener") && !isEmptyAlbumSlot(entry)) : [];
  const visibleProposals = focusedProposal ? proposals.filter((entry) => entry.id === focusedProposal) : proposals;
  const visibleListens = focusedReview ? listens.filter((entry) => entry.id === focusedReview) : listens;
  return <>{!member ? <section className="review-workspace"><div className="review-workspace__empty"><p>Connecte-toi pour proposer ton album ou rendre une écoute.</p><Link className="button" href="/connexion">Connexion</Link></div></section> : <><section className="review-workspace proposal-workspace"><div className="review-workspace__heading"><div><p className="eyebrow">MES PROPOSITIONS</p><h2>Les albums que je <em>propose.</em></h2><p>Toutes tes lignes encore ouvertes restent accessibles ici, quel que soit leur tirage.</p></div><span className="review-counter">{proposals.length} slot{proposals.length > 1 ? "s" : ""}</span></div><div className="review-queue">{visibleProposals.length ? visibleProposals.map((entry) => <ProposalCard key={`${entry.id}:${entry.album_title ?? ""}:${entry.album_artist ?? ""}:${entry.cover_path ?? ""}`} entry={entry} saving={savingId === entry.id} onSave={onProposal} onDelete={onDeleteProposal} />) : <div className="review-workspace__empty"><p>Aucune proposition ouverte pour l’instant.</p></div>}</div></section><section className="review-workspace"><div className="review-workspace__heading"><div><p className="eyebrow">MES ÉCOUTES À RENDRE</p><h2>Les albums que je dois <em>écouter.</em></h2><p>Toute ligne où tu es désigné·e « écouté par » reste disponible tant que le verdict est absent.</p></div><span className="review-counter">{listens.length} écoute{listens.length > 1 ? "s" : ""}</span></div><div className="review-queue">{visibleListens.length ? visibleListens.map((entry) => <ReviewCard key={entry.id} entry={entry} existing={reviewMap.get(entry.id)} saving={savingId === entry.id} onSave={onReview} onReset={onResetReview} />) : <div className="review-workspace__empty"><p>Rien à rendre dans les tirages actifs pour l’instant.</p></div>}</div></section><HistoricalPendingReviews albums={albums} member={member} /></>}</>;
}

function AdminDraws({ albums = archivedAlbums, entries, draws, savingId, onCreate, onDelete, onValidate, onPublish }: { albums?: Album[]; entries: DrawEntry[]; draws: DrawMeta[]; savingId: string | null; onCreate: (participants: string[]) => void; onDelete: (draw: number) => void; onValidate: (draw: number, assignments: Array<{ entry: DrawEntry; proposer: string; listener: string }>) => Promise<void>; onPublish: (draw: number) => void }) {
  const [drafts, setDrafts] = useState<Record<string, { proposer: string; listener: string }>>({});
  const [participants, setParticipants] = useState(() => roster.map((member) => member.username));
  const [duoNotice, setDuoNotice] = useState<{ draw: number; invalidIds: string[]; message: string } | null>(null);
  const rowsByDraw = new Map<number, DrawEntry[]>(); entries.forEach((entry) => rowsByDraw.set(entry.draw_number, [...(rowsByDraw.get(entry.draw_number) ?? []), entry]));
  const archivedPairs = new Set(albums.map((album) => duoKey(album.proposedBy, album.listenedBy)).filter(Boolean));
  const field = (entry: DrawEntry) => drafts[entry.id] ?? { proposer: entry.proposed_by_name ?? "", listener: entry.listened_by_name ?? "" };
  const change = (entry: DrawEntry, key: "proposer" | "listener", next: string) => setDrafts((current) => ({ ...current, [entry.id]: { ...field(entry), [key]: next } }));
  const toggleParticipant = (username: string) => setParticipants((current) => current.includes(username) ? current.filter((value) => value !== username) : [...current, username]);
  const validateDraw = async (draw: DrawMeta) => {
    const rows = (rowsByDraw.get(draw.draw_number) ?? []).sort((a, b) => a.position - b.position);
    const priorDraws = new Set(draws.filter((candidate) => candidate.draw_number !== draw.draw_number && candidate.status !== "draft").map((candidate) => candidate.draw_number));
    const seenPairs = new Set([...archivedPairs, ...entries.filter((entry) => priorDraws.has(entry.draw_number) && entry.proposed_by_name && entry.listened_by_name).map((entry) => duoKey(entry.proposed_by_name, entry.listened_by_name)).filter(Boolean)]);
    const assignments = rows.map((entry) => ({ entry, ...field(entry) }));
    const incomplete = assignments.filter(({ proposer, listener }) => !proposer || !listener).map(({ entry }) => entry.id);
    const selfPairs = assignments.filter(({ proposer, listener }) => proposer && proposer === listener).map(({ entry }) => entry.id);
    const repeatedPairs = assignments.filter(({ proposer, listener }) => proposer && listener && seenPairs.has(duoKey(proposer, listener))).map(({ entry }) => entry.id);
    const invalidIds = [...new Set([...incomplete, ...selfPairs, ...repeatedPairs])];
    if (invalidIds.length) {
      const reasons = [incomplete.length ? "des lignes incomplètes" : "", selfPairs.length ? "des membres attribués à eux-mêmes" : "", repeatedPairs.length ? "des duos déjà rencontrés" : ""].filter(Boolean).join(", ");
      setDuoNotice({ draw: draw.draw_number, invalidIds, message: `Alerte : corrige ${reasons} avant de publier.` });
      return;
    }
    setDuoNotice({ draw: draw.draw_number, invalidIds: [], message: "Tous les duos sont valides et ne se répètent pas dans les anciens tirages." });
    await onValidate(draw.draw_number, assignments);
  };
  return <section className="draw-sheet admin-draw-sheet"><div className="draw-creator"><div><span className="eyebrow">ADMINISTRATION</span><h3>Préparer un nouveau tirage</h3><p>Choisis les membres présents : chacun recevra exactement une ligne « proposé par » et une ligne « écouté par ».</p><div className="draw-participants">{roster.map((member) => <label className={`draw-participant${participants.includes(member.username) ? " is-selected" : ""}`} key={member.username}><input type="checkbox" checked={participants.includes(member.username)} onChange={() => toggleParticipant(member.username)} /><span>{member.displayName}</span></label>)}</div></div><button type="button" className="button" disabled={savingId === "new-draw" || participants.length < 2} onClick={() => onCreate(participants)}>{savingId === "new-draw" ? "Création…" : `Créer un tirage de ${participants.length} membres`}</button></div>{draws.map((draw) => { const rows = (rowsByDraw.get(draw.draw_number) ?? []).sort((a, b) => a.position - b.position); const editable = draw.status !== "locked"; const options = roster.filter((member) => draw.participant_usernames.includes(member.username)); const priorDraws = new Set(draws.filter((candidate) => candidate.draw_number !== draw.draw_number && candidate.status !== "draft").map((candidate) => candidate.draw_number)); const seenPairs = new Set(entries.filter((candidate) => priorDraws.has(candidate.draw_number) && candidate.proposed_by_name && candidate.listened_by_name).map((candidate) => `${candidate.proposed_by_name!.toLowerCase()}|${candidate.listened_by_name!.toLowerCase()}`)); const complete = rows.length === draw.participant_usernames.length && rows.every((entry) => { const current = field(entry); return Boolean(current.proposer && current.listener); }); return <section className="draw-section" key={draw.draw_number}><div className="draw-heading"><span className="eyebrow">TIRAGE {String(draw.draw_number).padStart(2, "0")} · {draw.status === "locked" ? "VERROUILLÉ" : draw.status === "published" ? "PUBLIÉ" : "BROUILLON"} · DUOS UNIQUES</span>{editable && <div><button className="sheet-entry-action" type="button" disabled={savingId === `validate-${draw.draw_number}`} onClick={() => void validateDraw(draw)}>{savingId === `validate-${draw.draw_number}` ? "Validation…" : "Valider les duos"}</button><button className="sheet-entry-action" type="button" disabled={draw.status !== "draft" || !complete || savingId === `publish-${draw.draw_number}`} onClick={() => onPublish(draw.draw_number)}>{savingId === `publish-${draw.draw_number}` ? "Publication…" : "Publier ce tirage"}</button><button className="sheet-entry-action sheet-entry-action--delete" type="button" disabled={savingId === `delete-${draw.draw_number}`} onClick={() => onDelete(draw.draw_number)}>Supprimer</button></div>}</div>{duoNotice?.draw === draw.draw_number && <p className={`duo-notice${duoNotice.invalidIds.length ? " duo-notice--alert" : ""}`}>{duoNotice.message}</p>}<div className="sheet-scroll"><table className="sheet-table admin-draw-table"><thead><tr><th>Ligne</th><th>Proposé par</th><th>Écouté par</th></tr></thead><tbody>{rows.map((entry) => { const current = field(entry); const selfPair = Boolean(current.proposer && current.proposer === current.listener); const repeatedPair = Boolean(current.proposer && current.listener && seenPairs.has(`${current.proposer}|${current.listener}`)); const proposedOptions = options.filter((member) => (member.username === current.proposer || !rows.some((other) => other.id !== entry.id && field(other).proposer === member.username)) && member.username !== current.listener); const listenerOptions = options.filter((member) => (member.username === current.listener || !rows.some((other) => other.id !== entry.id && field(other).listener === member.username)) && member.username !== current.proposer); const isAlerted = duoNotice?.draw === draw.draw_number && duoNotice.invalidIds.includes(entry.id); return <tr className={isAlerted || selfPair || repeatedPair ? "sheet-row--alert" : ""} key={entry.id}><td>{String(entry.position).padStart(2, "0")}</td><td><MemberSelect value={current.proposer} options={proposedOptions} disabled={!editable} label="Choisir le proposeur" onChange={(next) => change(entry, "proposer", next)} /></td><td><MemberSelect value={current.listener} options={listenerOptions} disabled={!editable} label="Choisir la personne qui écoute" onChange={(next) => change(entry, "listener", next)} /></td></tr>; })}</tbody></table></div>{draw.status === "draft" && !complete && <p className="sheet-pending">Attribue chaque participant une fois dans chaque colonne, puis valide les duos avant de publier.</p>}</section>; })}</section>;
}

function Kouize({ profiles, member, isAdmin }: { profiles: PublicKouizeProfile[]; member: SignedMember | null; isAdmin: boolean }) {
  const profileMap = new Map(profiles.map((profile) => [profile.username.toLowerCase(), profile.kouize]));
  return <section className="quiz-sheet"><div className="quiz-intro kouize-intro"><p className="eyebrow">KOUIZE DU CLUB</p><h2>Les goûts, <br /><em>directement depuis les profils.</em></h2><p>{member && !isAdmin ? "Complète ou modifie tes réponses depuis Mon compte : le Kouize se met ici à jour automatiquement." : "Chaque case reprend les réponses publiques renseignées sur le profil de son membre."}</p></div><div className="quiz-scroll kouize-scroll"><table className="quiz-table kouize-table"><thead><tr><th>Repère</th>{roster.map((clubMember) => <th key={clubMember.username}>{clubMember.displayName}</th>)}</tr></thead><tbody>{quizQuestions.map((question) => <tr key={question.key}><th><span>{question.label}</span><b>{question.question}</b><small>{question.prompt}</small></th>{roster.map((clubMember) => { const answer = kouizeValue(profileMap.get(clubMember.username.toLowerCase()), question.key); return <td key={clubMember.username}><span className={`kouize-answer${answer ? "" : " is-empty"}`}>{answer || "—"}</span></td>; })}</tr>)}</tbody></table></div></section>;
}

export function TableurBoard({ albums }: { albums: Album[] }) {
  const configured = isSupabaseConfigured(); const [activeTab, setActiveTab] = useState<Tab>("archive"); const [member, setMember] = useState<SignedMember | null>(null); const [isAdmin, setIsAdmin] = useState(false); const [entries, setEntries] = useState<DrawEntry[]>([]); const [draws, setDraws] = useState<DrawMeta[]>([]); const [reviews, setReviews] = useState<ReviewRecord[]>([]); const [publicReviews, setPublicReviews] = useState<ReviewRecord[]>([]); const [kouizeProfiles, setKouizeProfiles] = useState<PublicKouizeProfile[]>([]); const [savingId, setSavingId] = useState<string | null>(null); const [message, setMessage] = useState(""); const [focusedProposal, setFocusedProposal] = useState<string | null>(null); const [focusedReview, setFocusedReview] = useState<string | null>(null); const [archiveFocusId, setArchiveFocusId] = useState<string | null>(null);
  const visibleTabs = isAdmin ? [...tabs, adminTab, historyTab] : tabs; const active = visibleTabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const loadEntries = useCallback(async () => { if (!configured) return; const columns = member ? "id, draw_number, position, proposed_by, listened_by, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url" : "id, draw_number, position, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url"; const { data, error } = await getSupabaseBrowserClient().from("club_draw_entries").select(columns).order("draw_number", { ascending: true }).order("position", { ascending: true }); if (!error) setEntries((data ?? []) as DrawEntry[]); }, [configured, member]);
  const loadDraws = useCallback(async () => { if (!configured) return; const { data, error } = await getSupabaseBrowserClient().from("club_draws").select("draw_number, participant_usernames, status, avoid_repeated_pairs").order("draw_number", { ascending: true }); if (!error) setDraws((data ?? []) as DrawMeta[]); }, [configured]);
  const loadReviews = useCallback(async () => { if (!configured) return; const { data, error } = await getSupabaseBrowserClient().from("member_album_reviews").select("album_id, review_title, review, rating, best_track, worst_track"); if (!error) setReviews((data ?? []) as ReviewRecord[]); }, [configured]);
  const loadPublicReviews = useCallback(async () => { if (!configured) return; const { data, error } = await getSupabaseBrowserClient().rpc("get_public_draw_reviews"); if (!error) setPublicReviews((data ?? []) as ReviewRecord[]); }, [configured]);
  const syncAccess = useCallback(async () => { if (!configured) return; const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getUser(); const user = data.user; if (!user) { setMember(null); setIsAdmin(false); setReviews([]); return; } const { data: profile } = await supabase.from("member_profiles").select("role, username, display_name").eq("id", user.id).maybeSingle(); const metadataUsername = typeof user.app_metadata.username === "string" ? user.app_metadata.username : user.email?.split("@")[0] ?? "membre"; const username = profile?.username ?? metadataUsername; const displayName = profile?.display_name ?? roster.find((entry) => entry.username === username)?.displayName ?? username; setMember((current) => current && current.id === user.id && current.username === username && current.displayName === displayName ? current : { id: user.id, username, displayName }); setIsAdmin(profile?.role === "admin"); await loadReviews(); }, [configured, loadReviews]);
  useEffect(() => { const timer = setTimeout(() => { void loadEntries(); void loadDraws(); void loadPublicReviews(); void syncAccess(); if (configured) void getSupabaseBrowserClient().from("member_public_profiles").select("username, kouize").then((result: { data: unknown }) => setKouizeProfiles((result.data ?? []) as PublicKouizeProfile[])); }, 0); return () => clearTimeout(timer); }, [configured, loadDraws, loadEntries, loadPublicReviews, syncAccess]);
  useEffect(() => { if (!configured) return; const { data } = getSupabaseBrowserClient().auth.onAuthStateChange(() => void syncAccess()); return () => data.subscription.unsubscribe(); }, [configured, syncAccess]);
  const goToProposal = (id: string) => { setFocusedProposal(id); setFocusedReview(null); setActiveTab("selection"); };
  const goToReview = (id: string) => { setFocusedReview(id); setFocusedProposal(null); setActiveTab("selection"); };
  const returnToDraw = (entryId: string) => { setFocusedProposal(null); setFocusedReview(null); setArchiveFocusId(entryId); setActiveTab("archive"); };
  const saveProposal = async ({ entryId, title, artist, file, match }: ProposalPayload) => { if (!configured || !member) return; setSavingId(entryId); setMessage(""); let cover_path: string | undefined; try { if (file) { if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Choisis une image JPG, PNG ou WebP de 5 Mo maximum."); const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"; const path = `${member.id}/${entryId}.${extension}`; const { error } = await getSupabaseBrowserClient().storage.from("album-covers").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" }); if (error) throw error; cover_path = path; } else if (match?.thumbnailUrl) { const { data } = await getSupabaseBrowserClient().auth.getSession(); const imported = await fetch("/api/music/import-cover", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ entryId, imageUrl: match.thumbnailUrl }) }).then(async (response) => response.ok ? response.json() as Promise<{ coverPath?: string }> : null).catch(() => null); cover_path = imported?.coverPath; } const metadata = match === undefined ? {} : match ? { youtube_playlist_id: match.resourceType === "playlist" ? match.resourceId : null, youtube_video_id: match.resourceType === "video" ? match.resourceId : null, youtube_music_url: match.youtubeMusicUrl, youtube_url: match.youtubeUrl, cover_source_url: match.thumbnailUrl, music_channel_title: match.channelTitle, music_resource_type: match.resourceType, music_match_confidence: match.confidence, music_metadata_source: "automatic", music_metadata_verified: false } : { youtube_playlist_id: null, youtube_video_id: null, youtube_music_url: null, youtube_url: null, cover_source_url: null, music_channel_title: null, music_resource_type: "search", music_match_confidence: null, music_metadata_source: "member", music_metadata_verified: false }; const update = { album_title: title.trim(), album_artist: artist.trim(), ...metadata, ...(cover_path ? { cover_path } : {}) }; const { error } = await getSupabaseBrowserClient().from("club_draw_entries").update(update).eq("id", entryId); if (error) throw error; await Promise.all([loadEntries(), loadPublicReviews()]); setMessage(match ? "Album confirmé : la pochette et le lien sont enregistrés." : "Album proposé : il apparaît maintenant dans le tirage."); returnToDraw(entryId); } catch (error) { setMessage(error instanceof Error ? error.message : "L’album n’a pas pu être enregistré."); } finally { setSavingId(null); } };
  const deleteProposal = async (entryId: string) => { if (!configured || !member) return; setSavingId(entryId); setMessage(""); try { const { error } = await getSupabaseBrowserClient().from("club_draw_entries").update({ album_title: null, album_artist: null, cover_path: null, youtube_playlist_id: null, youtube_video_id: null, youtube_music_url: null, youtube_url: null, cover_source_url: null, youtube_published_at: null, music_channel_title: null, music_resource_type: "search", music_match_confidence: null, music_metadata_source: "member", music_metadata_verified: false }).eq("id", entryId); if (error) throw error; await Promise.all([loadEntries(), loadPublicReviews()]); setMessage("Album retiré de ta proposition."); returnToDraw(entryId); } catch (error) { setMessage(error instanceof Error ? error.message : "Cet album ne peut plus être retiré : un verdict a peut-être déjà été enregistré."); } finally { setSavingId(null); } };
  const saveReview = async ({ entryId, reviewTitle, review, rating, bestTrack, worstTrack, bestMatch, worstMatch }: ReviewPayload) => { if (!configured || !member || !review.trim() || !isHalfStepRating(rating) || rating < 0 || rating > 5) return; setSavingId(entryId); setMessage(""); try { const { data: saved, error } = await getSupabaseBrowserClient().from("member_album_reviews").upsert({ album_id: entryId, member_id: member.id, review_title: reviewTitle?.trim() || null, review: review.trim(), rating, best_track: bestTrack.trim() || null, worst_track: worstTrack.trim() || null }, { onConflict: "album_id,member_id" }).select("id").single(); if (error || !saved?.id) throw error ?? new Error("Verdict introuvable."); const { data: session } = await getSupabaseBrowserClient().auth.getSession(); const payload = (selectionType: "best" | "worst", title: string, match: import("@/lib/music-matching").MusicCandidate | null | undefined) => ({ selectionType, title: title.trim(), artists: match?.artist ? [match.artist] : [], youtubeVideoId: match?.resourceType === "video" ? match.resourceId : null, youtubeMusicUrl: match?.youtubeMusicUrl ?? null, youtubeUrl: match?.youtubeUrl ?? null, thumbnailUrl: match?.thumbnailUrl ?? null, source: match ? "youtube_search" : "manual", verified: false }); const tracks = await fetch("/api/music/track-selections", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.session?.access_token ?? ""}` }, body: JSON.stringify({ entryId, reviewId: saved.id, selections: [payload("best", bestTrack, bestMatch), payload("worst", worstTrack, worstMatch)] }) }); await Promise.all([loadEntries(), loadReviews(), loadPublicReviews()]); setMessage(tracks.ok ? "Verdict et liens de morceaux enregistrés dans le tirage." : "Verdict enregistré dans le tirage. Les liens YouTube pourront être complétés plus tard."); returnToDraw(entryId); } catch (error) { setMessage(error instanceof Error ? error.message : "Ce verdict n’a pas pu être enregistré."); } finally { setSavingId(null); } };
  const resetReview = async (entryId: string) => { if (!configured || !member) return; setSavingId(entryId); setMessage(""); try { const { error } = await getSupabaseBrowserClient().from("member_album_reviews").delete().eq("album_id", entryId).eq("member_id", member.id); if (error) throw error; await Promise.all([loadEntries(), loadReviews(), loadPublicReviews()]); setMessage("Verdict réinitialisé : la ligne est de nouveau en attente."); returnToDraw(entryId); } catch (error) { setMessage(error instanceof Error ? error.message : "Le verdict n’a pas pu être réinitialisé."); } finally { setSavingId(null); } };
  const createDraw = async (participants: string[]) => { if (!configured || !isAdmin) return; setSavingId("new-draw"); setMessage(""); const { error } = await getSupabaseBrowserClient().rpc("admin_create_club_draw", { p_participant_usernames: participants, p_avoid_repeated_pairs: true }); setSavingId(null); if (error) setMessage(error.message); else { setMessage("Nouveau brouillon créé : valide les duos avant de le publier."); await Promise.all([loadEntries(), loadDraws()]); } };
  const validateAssignments = async (draw: number, assignments: Array<{ entry: DrawEntry; proposer: string; listener: string }>) => { if (!configured || !isAdmin) return; const resetsAnAlbum = assignments.some(({ entry, proposer, listener }) => (entry.album_title || entry.album_artist) && (proposer !== entry.proposed_by_name || listener !== entry.listened_by_name)); if (resetsAnAlbum && !confirm("Modifier ces attributions supprimera les albums et avis concernés. Continuer ?")) return; setSavingId(`validate-${draw}`); setMessage(""); try { for (const assignment of assignments) { if (assignment.proposer === assignment.entry.proposed_by_name && assignment.listener === assignment.entry.listened_by_name) continue; const hasContent = Boolean(assignment.entry.album_title || assignment.entry.album_artist); const { error } = await getSupabaseBrowserClient().rpc("admin_update_club_draw_entry", { p_entry_id: assignment.entry.id, p_proposer_username: assignment.proposer, p_listener_username: assignment.listener, p_confirm_reset: hasContent }); if (error) throw error; } setMessage("Duos validés dans le brouillon."); await loadEntries(); } catch (error) { setMessage(error instanceof Error ? error.message : "Les duos n’ont pas pu être validés."); } finally { setSavingId(null); } };
  const publishDraw = async (draw: number) => { if (!configured || !isAdmin || !confirm(`Publier le tirage ${draw} ? Le précédent sera verrouillé.`)) return; setSavingId(`publish-${draw}`); setMessage(""); const { error } = await getSupabaseBrowserClient().rpc("admin_publish_club_draw", { p_draw_number: draw }); setSavingId(null); if (error) setMessage(error.message); else { setMessage("Tirage publié : le précédent est verrouillé."); await Promise.all([loadEntries(), loadDraws()]); } };
  const deleteDraw = async (draw: number) => { if (!configured || !isAdmin || !confirm(`Supprimer le tirage ${draw} ?`)) return; setSavingId(`delete-${draw}`); const { error } = await getSupabaseBrowserClient().rpc("admin_delete_club_draw", { p_draw_number: draw }); setSavingId(null); if (error) setMessage(error.message); else { setMessage("Tirage supprimé."); await Promise.all([loadEntries(), loadDraws()]); } };
  return <section className="tableur-board" aria-label="Tableur du DOL ZIKLUB"><div className="sheet-tabs" role="tablist">{visibleTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div><div className="sheet-meta"><span className="eyebrow">{active.label}</span><span>{active.hint}</span></div>{activeTab === "admin" && message && <p className="selection-message" role="status">{message}</p>}<div role="tabpanel">{activeTab === "archive" && <div className="sheet-archive"><LiveDraws entries={entries} reviews={publicReviews} draws={draws} member={member} onOpenProposal={goToProposal} onOpenReview={goToReview} focusEntryId={archiveFocusId} /><HistoricalDraws albums={albums} /></div>}{activeTab === "selection" && <SelectionWorkspace albums={albums} entries={entries} draws={draws} member={member} reviews={reviews} focusedProposal={focusedProposal} focusedReview={focusedReview} savingId={savingId} onProposal={(payload) => void saveProposal(payload)} onDeleteProposal={(entryId) => void deleteProposal(entryId)} onReview={(payload) => void saveReview(payload)} onResetReview={(entryId) => void resetReview(entryId)} />}{activeTab === "kouize" && <Kouize profiles={kouizeProfiles} member={member} isAdmin={isAdmin} />}{activeTab === "admin" && isAdmin && <AdminDraws entries={entries} draws={draws} savingId={savingId} onCreate={(participants) => void createDraw(participants)} onDelete={(draw) => void deleteDraw(draw)} onPublish={(draw) => void publishDraw(draw)} onValidate={(draw, assignments) => validateAssignments(draw, assignments)} />}{activeTab === "history" && isAdmin && <AdminDrawHistory />}</div></section>;
}

void LegacyLiveDraws;
