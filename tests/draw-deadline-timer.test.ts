import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const countdown = readFileSync("src/components/draw-countdown.tsx", "utf8");
const countdownStyles = readFileSync("src/components/draw-countdown.module.css", "utf8");
const liveDraws = readFileSync("src/components/live-draws.tsx", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260726101842_draw_deadline_timer_and_reminders.sql",
  "utf8",
);
const updates = readFileSync("src/data/site-updates.ts", "utf8");

test("the current draw owns a real-time seven-day Paris countdown", () => {
  assert.match(countdown, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(countdown, /window\.setInterval\(update, 1_000\)/);
  assert.match(countdown, /timeZone: "Europe\/Paris"/);
  assert.match(countdown, /Math\.max\(0, deadlineMs - nowMs\)/);
  assert.match(countdown, /data-finished=\{finished \|\| undefined\}/);
  assert.match(liveDraws, /draw\.status === "published" \? <DrawCountdown createdAt=\{draw\.created_at\}/);
  assert.match(tableur, /global_proposer_username, created_at/);
});

test("the countdown stays readable from desktop through mobile", () => {
  assert.match(countdownStyles, /font-variant-numeric: tabular-nums/);
  assert.match(countdownStyles, /@media \(max-width: 960px\)/);
  assert.match(countdownStyles, /width: 100%/);
  assert.match(countdown, /role="timer"/);
  assert.match(countdown, /heure de Paris/);
});

test("Supabase sends each halfway and last-day reminder once", () => {
  assert.match(migration, /create extension if not exists pg_cron/);
  assert.match(migration, /private\.draw_reminder_deliveries/);
  assert.match(migration, /alter table private\.draw_reminder_deliveries enable row level security/);
  assert.match(migration, /revoke all on table private\.draw_reminder_deliveries from public, anon, authenticated/);
  assert.match(migration, /interval '3 days 12 hours'/);
  assert.match(migration, /interval '6 days'/);
  assert.match(migration, /interval '7 days'/);
  assert.match(migration, /review\.album_id = entry\.id::text/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(migration, /cron\.schedule/);
  assert.match(migration, /'\*\/15 \* \* \* \*'/);
  assert.doesNotMatch(migration, /insert into cron\.job|update cron\.job/i);
});

test("the dated updates page records the timer and its notifications", () => {
  assert.match(updates, /id: "draw-deadline-timer-reminders"/);
  assert.match(updates, /version: "2\.1"/);
  assert.match(updates, /date: "2026-07-26"/);
  assert.match(migration, /'draw-deadline-timer-reminders'/);
});
