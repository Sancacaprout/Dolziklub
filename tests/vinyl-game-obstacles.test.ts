import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  actionProgress,
  createObstacle,
  createRunnerWave,
  GAME,
  obstacleActionForVariant,
  playerClearsObstacle,
  playerLift,
  randomWaveGap,
  slideBlend,
} from "../src/lib/vinyl-game/engine";

const game = readFileSync(resolve("src/components/hero-vinyl-game.tsx"), "utf8");
const styles = readFileSync(resolve("src/app/globals.css"), "utf8");

function sequence(values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test("maps each supplied obstacle to the expected runner action", () => {
  assert.equal(obstacleActionForVariant("low-barrier"), "jump");
  assert.equal(obstacleActionForVariant("overhead-barrier"), "slide");
  assert.equal(obstacleActionForVariant("blocker-a"), "switch-lane");
  assert.equal(obstacleActionForVariant("blocker-b"), "switch-lane");
});

test("requires the correct move only when Wheely occupies the obstacle lane", () => {
  const low = createObstacle(1, 0, "low-barrier");
  const overhead = createObstacle(2, 0, "overhead-barrier");
  const blocker = createObstacle(3, 0, "blocker-a");

  assert.equal(playerClearsObstacle(low, true, "jumping"), true);
  assert.equal(playerClearsObstacle(low, true, "fast-falling"), true);
  assert.equal(playerClearsObstacle(low, true, "running"), false);
  assert.equal(playerClearsObstacle(overhead, true, "sliding"), true);
  assert.equal(playerClearsObstacle(overhead, true, "jumping"), false);
  assert.equal(playerClearsObstacle(blocker, true, "sliding"), false);
  assert.equal(playerClearsObstacle(blocker, false, "running"), true);
});

test("creates fair three-lane patterns that force a jump or a slide", () => {
  const wave = createRunnerWave(sequence([0, 0, 0.1, 0, 0.2, 0.2]));
  assert.equal(wave.length, 3);
  assert.deepEqual(new Set(wave.map((item) => item.lane)), new Set([-1, 0, 1]));
  const actionObstacles = wave.filter((item) => item.kind === "obstacle" && (item.variant === "low-barrier" || item.variant === "overhead-barrier"));
  assert.equal(actionObstacles.length, 1);
  assert.equal(actionObstacles[0]?.lane, 0);
  assert.equal(wave.filter((item) => item.kind === "album").length, 2);
});

test("keeps the remaining random waves dense, varied and never blocks all lanes", () => {
  const regularWave = createRunnerWave(sequence([0, 0, 0.9, 0.1, 0.1]));
  assert.equal(regularWave.length, 2);
  assert.equal(randomWaveGap(GAME.startSpeed, () => 0), GAME.minWaveGap);
  assert.ok(randomWaveGap(GAME.startSpeed, () => 1) <= GAME.maxWaveGap);
  assert.match(game, /lastWaveSignature/);
  assert.match(game, /randomWaveGap\(runtime\.speed\)/);
});

test("uses Animation only during loading and removes passed obstacles early", () => {
  for (const asset of [
    "/game/obstacles/blocker-a.png",
    "/game/obstacles/blocker-b.png",
    "/game/obstacles/low-barrier.png",
    "/game/obstacles/overhead-barrier.png",
  ]) assert.ok(game.includes(asset));

  assert.ok(game.includes("/game/transition/wheely-loading.png"));
  assert.doesNotMatch(game, /animated-blocker/);
  assert.match(styles, /wheely-loader-cross/);
  assert.equal(GAME.albumDespawnDepth, 0.83);
  assert.equal(GAME.obstacleDespawnDepth, 0.85);
});

test("keeps Canvas work close to 60 FPS without per-frame sorting or blur filters", () => {
  assert.match(game, /const TARGET_FRAME_MS = 1000 \/ 60/);
  assert.match(game, /TARGET_FRAME_MS - FRAME_TOLERANCE_MS/);
  assert.doesNotMatch(game, /\[\.\.\.runtime\.(walls|obstacles)\]\.sort/);
  assert.doesNotMatch(game, /ctx\.filter/);
  assert.ok(GAME.startSpeed > 0.19);
  assert.ok(GAME.maxSpeed >= 0.46);
});
test("supports progressive crouching and an accelerated fall", () => {
  assert.equal(actionProgress(50, 0, 100), 0.5);
  assert.equal(playerLift("jumping", 0.5), 1);
  assert.equal(playerLift("fast-falling", 0, 0.8), 0.8);
  assert.ok(Math.abs(playerLift("fast-falling", 0.5, 0.8) - 0.4) < 0.0001);
  assert.equal(playerLift("fast-falling", 1, 0.8), 0);
  assert.equal(slideBlend("sliding", 0), 0);
  assert.equal(slideBlend("sliding", 0.5), 1);
  assert.ok(Math.abs(slideBlend("sliding", 1)) < 0.0001);
  assert.ok(GAME.fastFallDuration < GAME.jumpDuration);
  assert.ok(GAME.fastFallCooldown > GAME.fastFallDuration);
});

test("finishes the run when the music ends and keeps results readable", () => {
  assert.match(game, /onEnded=\{win\}/);
  assert.doesNotMatch(game, /<audio[^>]+\sloop/);
  assert.match(game, /phase === "victory"/);
  assert.match(game, /Le disque t’a rayé\./);
  assert.match(game, /vinyl-runner__summary/);
  assert.match(styles, /\.vinyl-runner__summary/);
  assert.ok(GAME.passedDepthMultiplier >= 3);
  assert.match(game, /retainBeforeDepth\(runtime\.walls/);
  assert.match(game, /retainBeforeDepth\(runtime\.obstacles/);
});
