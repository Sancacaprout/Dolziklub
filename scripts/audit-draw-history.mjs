import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function historicalDraw(position) {
  if (position <= 10) return 1;
  if (position <= 19) return 2;
  if (position <= 28) return 3;
  if (position <= 36) return 4;
  if (position <= 45) return 5;
  return 6;
}

function countBy(rows, getKey) {
  const counts = {};
  for (const row of rows) {
    const key = getKey(row) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

const env = { ...readEnv(".env.production.local"), ...readEnv(".env.local") };
const readKey = process.env.DOL_AUDIT_SUPABASE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
env.NEXT_PUBLIC_SUPABASE_URL ||= "https://kcizszuvrtnlxgikgfdx.supabase.co";
if (!env.NEXT_PUBLIC_SUPABASE_URL || !readKey) {
  throw new Error("Supabase read credentials are unavailable.");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, readKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const unavailableTables = [];

async function readRpc(name) {
  const { data, error } = await supabase.rpc(name);
  if (error) { unavailableTables.push({ table: name, reason: error.message }); return []; }
  return data ?? [];
}

async function readTable(table, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns).limit(5000);
  if (error) {
    unavailableTables.push({ table, reason: error.message });
    return [];
  }
  return data ?? [];
}

const [members, draws, entries, reviews, archivedReviews, bonusReviews, extraRequests, badges] = await Promise.all([
  readTable("member_public_profiles", "id,username"),
  readTable("club_draws"),
  readTable("club_draw_entries"),
  readRpc("get_public_draw_reviews"),
  readTable("archived_album_reviews"),
  readRpc("get_public_bonus_draw_reviews"),
  readTable("extra_listening_requests"),
  readTable("participant_badges"),
]);

const aliases = new Map();
for (const member of members) {
  aliases.set(normalize(member.username), member);
  aliases.set(normalize(member.display_name), member);
}
aliases.set("toma", aliases.get("thomas") ?? aliases.get("toma"));
aliases.set("thomas", aliases.get("thomas") ?? aliases.get("toma"));

const archive = JSON.parse(readFileSync("src/data/albums.generated.json", "utf8"));
const historical = archive.filter((album) => album.position <= 45);
const historicalAnomalies = [];
for (const album of historical) {
  if (!aliases.get(normalize(album.proposedBy))) {
    historicalAnomalies.push({ archive: album.position, field: "proposedBy", value: album.proposedBy });
  }
  if (!aliases.get(normalize(album.listenedBy))) {
    historicalAnomalies.push({ archive: album.position, field: "listenedBy", value: album.listenedBy });
  }
}

const reviewsByEntry = new Map(reviews.map((review) => [review.album_id, review]));
const drawReport = draws
  .map((draw) => {
    const rows = entries.filter((entry) => entry.draw_number === draw.draw_number);
    const filled = rows.filter((entry) => entry.album_title?.trim() && entry.album_artist?.trim());
    const rowReviews = rows.flatMap((entry) => reviewsByEntry.has(entry.id) ? [reviewsByEntry.get(entry.id)] : []);
    return {
      draw: draw.draw_number,
      type: draw.draw_type ?? "standard",
      status: draw.status,
      participants: draw.participant_usernames?.length ?? 0,
      assignments: rows.length,
      filledAlbums: filled.length,
      reviews: rowReviews.length,
      ratings: rowReviews.filter((review) => review.rating != null).length,
      archiveNumbers: filled.map((entry) => entry.archive_number).filter(Number.isInteger).sort((a, b) => a - b),
      missingStableProposer: rows.filter((entry) => !entry.proposed_by).length,
      missingStableListener: rows.filter((entry) => !entry.listened_by).length,
    };
  })
  .sort((a, b) => a.draw - b.draw);

const archiveNumberDuplicates = Object.entries(countBy(
  entries.filter((entry) => Number.isInteger(entry.archive_number)),
  (entry) => String(entry.archive_number),
)).filter(([, count]) => count > 1);

const perMember = members.map((member) => {
  const names = new Set([normalize(member.username), normalize(member.display_name)]);
  if (names.has("thomas") || names.has("toma")) { names.add("thomas"); names.add("toma"); }
  const historicalProposals = historical.filter((album) => names.has(normalize(album.proposedBy))).length;
  const historicalListens = historical.filter((album) => names.has(normalize(album.listenedBy))).length;
  const liveProposals = entries.filter((entry) => entry.proposed_by === member.id && entry.album_title?.trim() && entry.album_artist?.trim()).length;
  const liveReviews = reviews.filter((review) => (review.reviewer_id ?? review.member_id) === member.id);
  const archiveRatings = archivedReviews.filter((review) => names.has(normalize(review.listener_username)) && review.rating != null);
  return {
    username: member.username,
    historicalProposals,
    historicalListens,
    liveProposals,
    liveReviews: liveReviews.length,
    archivedRatings: archiveRatings.length,
    bonusReviews: bonusReviews.filter((review) => review.member_id === member.id).length,
    extraReviewed: extraRequests.filter((request) => request.requester_id === member.id && request.status === "reviewed").length,
    badges: unavailableTables.some((item) => item.table === "participant_badges")
      ? null
      : badges.filter((badge) => badge.participant_id === member.id).length,
  };
}).sort((a, b) => a.username.localeCompare(b.username));

const report = {
  generatedAt: new Date().toISOString(),
  mode: "read-only-dry-run",
  credentialScope: env.SUPABASE_SERVICE_ROLE_KEY && !process.env.DOL_AUDIT_SUPABASE_KEY ? "service-role" : "publishable-key",
  unavailableTables,
  totals: {
    members: members.length,
    databaseDraws: draws.length,
    databaseEntries: entries.length,
    databaseReviews: reviews.length,
    archivedAlbums: archive.length,
    historicalAlbums1To5: historical.length,
    archivedReviewRows: archivedReviews.length,
    bonusReviews: bonusReviews.length,
    extraRequests: extraRequests.length,
    unlockedBadges: unavailableTables.some((item) => item.table === "participant_badges") ? null : badges.length,
  },
  drawReport,
  staticHistory: [1, 2, 3, 4, 5].map((draw) => {
    const rows = historical.filter((album) => historicalDraw(album.position) === draw);
    return {
      draw,
      albums: rows.length,
      proposals: rows.length,
      assignments: rows.length,
      ratings: rows.filter((album) => album.rating != null).length,
      reviews: rows.filter((album) => album.shortReview?.trim()).length,
      bestTracks: rows.filter((album) => album.bestTrack?.title?.trim()).length,
      worstTracks: rows.filter((album) => album.worstTrack?.title?.trim()).length,
    };
  }),
  perMember,
  anomalies: {
    missingDrawNumbers: [1, 2, 3, 4, 5, 6, 7, 8].filter((number) => !draws.some((draw) => draw.draw_number === number)),
    historicalIdentityMisses: historicalAnomalies,
    duplicateArchiveNumbers: archiveNumberDuplicates,
    liveEntriesWithoutDraw: entries.filter((entry) => !draws.some((draw) => draw.draw_number === entry.draw_number)).map((entry) => entry.id),
    reviewsWithoutEntry: reviews.filter((review) => !entries.some((entry) => entry.id === review.album_id)).map((review) => review.id),
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
