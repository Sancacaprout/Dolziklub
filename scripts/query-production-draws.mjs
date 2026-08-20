import { createClient } from "@supabase/supabase-js";

const key = process.env.DOL_AUDIT_SUPABASE_KEY;
if (!key) throw new Error("DOL_AUDIT_SUPABASE_KEY is required");
const supabase = createClient("https://kcizszuvrtnlxgikgfdx.supabase.co", key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function table(name, columns = "*") {
  const { data, error } = await supabase.from(name).select(columns).limit(5000);
  return { data: data ?? [], error: error?.message ?? null };
}

async function rpc(name) {
  const { data, error } = await supabase.rpc(name);
  return { data: data ?? [], error: error?.message ?? null };
}

const sourceNames = [
  "member_public_profiles",
  "club_draws",
  "club_draw_entries",
  "get_public_draw_reviews",
  "archived_album_reviews",
  "get_public_bonus_draw_reviews",
  "extra_listening_requests",
];
const results = await Promise.all([
  table("member_public_profiles", "id,username"),
  table("club_draws"),
  table("club_draw_entries"),
  rpc("get_public_draw_reviews"),
  table("archived_album_reviews"),
  rpc("get_public_bonus_draw_reviews"),
  table("extra_listening_requests"),
]);
const [members, draws, entries, reviews, archivedReviews, bonusReviews, extraRequests] = results.map((result) => result.data);

const reviewByAlbum = new Map(reviews.map((review) => [review.album_id, review]));
const report = {
  unavailableSources: Object.fromEntries(
    sourceNames.flatMap((name, index) => results[index].error ? [[name, results[index].error]] : []),
  ),
  totals: {
    members: members.length,
    draws: draws.length,
    entries: entries.length,
    reviews: reviews.length,
    archivedReviews: archivedReviews.length,
    bonusReviews: bonusReviews.length,
    extraRequests: extraRequests.length,
  },
  draws: draws
    .map((draw) => {
      const rows = entries.filter((entry) => entry.draw_number === draw.draw_number);
      const filled = rows.filter((entry) => entry.album_title?.trim() && entry.album_artist?.trim());
      const verdicts = rows.flatMap((entry) => reviewByAlbum.has(entry.id) ? [reviewByAlbum.get(entry.id)] : []);
      return {
        number: draw.draw_number,
        type: draw.draw_type,
        status: draw.status,
        participants: draw.participant_usernames,
        entries: rows.length,
        filled: filled.length,
        reviews: verdicts.length,
        archiveNumbers: filled.map((entry) => entry.archive_number).filter(Number.isInteger).sort((a, b) => a - b),
        missingProposerIds: rows.filter((entry) => !entry.proposed_by).length,
        missingListenerIds: rows.filter((entry) => !entry.listened_by).length,
      };
    })
    .sort((a, b) => a.number - b.number),
  members: members.map((member) => ({
    username: member.username,
    liveProposals: entries.filter((entry) => entry.proposed_by === member.id && entry.album_title?.trim()).length,
    liveListens: entries.filter((entry) => entry.listened_by === member.id && reviewByAlbum.has(entry.id)).length,
    bonusReviews: bonusReviews.filter((review) => review.member_username?.toLowerCase() === member.username.toLowerCase()).length,
    extraReviewed: extraRequests.filter((request) => request.requester_id === member.id && request.status === "reviewed").length,
  })).sort((a, b) => a.username.localeCompare(b.username)),
  anomalies: {
    missingDraws1To8: [1, 2, 3, 4, 5, 6, 7, 8].filter((number) => !draws.some((draw) => draw.draw_number === number)),
    orphanReviews: reviews.filter((review) => !entries.some((entry) => entry.id === review.album_id)).map((review) => review.album_id),
    duplicateArchiveNumbers: Object.entries(entries.reduce((counts, entry) => {
      if (Number.isInteger(entry.archive_number)) counts[entry.archive_number] = (counts[entry.archive_number] ?? 0) + 1;
      return counts;
    }, {})).filter(([, count]) => count > 1),
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
