import { readFileSync, writeFileSync } from "node:fs";

const path = "supabase/migrations/20260802074957_refactor_draw_history_badges_and_global_verdicts.sql";
const current = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const insertStart = current.indexOf("insert into draw_history_seed values\n");
const suffixStart = current.indexOf("\ndo $$\nbegin\n  if exists", insertStart);
const firstCommit = current.indexOf("\ncommit;", suffixStart);
if (insertStart < 0 || suffixStart < 0 || firstCommit < 0) throw new Error("Migration template boundaries not found");

const albums = JSON.parse(readFileSync("src/data/albums.generated.json", "utf8")).slice(0, 45);
const drawFor = (position) => position <= 10 ? 1 : position <= 19 ? 2 : position <= 28 ? 3 : position <= 36 ? 4 : 5;
const starts = { 1: 1, 2: 11, 3: 20, 4: 29, 5: 37 };
const quote = (value) => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const values = albums.map((album) => {
  const draw = drawFor(album.position);
  const review = [album.shortReview, album.detailedReview].filter(Boolean).join("\n\n") || null;
  return `  (${album.position}, ${draw}, ${album.position - starts[draw] + 1}, ${quote(album.title)}, ${quote(album.artist)}, ${quote(album.cover)}, ${quote(album.proposedBy)}, ${quote(album.listenedBy)}, ${album.rating == null ? "null" : Number(album.rating)}, ${quote(review)}, ${quote(album.bestTrack?.title)}, ${quote(album.worstTrack?.title)}, ${quote(album.albumUrl)})`;
}).join(",\n");

const prefix = current.slice(0, insertStart) + "insert into draw_history_seed values\n";
const suffix = current.slice(suffixStart, firstCommit + "\ncommit;".length);
writeFileSync(path, `${prefix}${values};${suffix}\n`, "utf8");
process.stdout.write(`Migration rebuilt with ${albums.length} immutable archive rows.\n`);
