"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  actionProgress,
  createObstacle,
  createRunnerWave,
  GAME,
  nextLane,
  OBSTACLE_VARIANTS,
  playerClearsObstacle,
  playerLift,
  randomWaveGap,
  runnerWaveSignature,
  slideBlend,
  type Lane,
  type ObstacleVariant,
  type PlayerState,
  type RunnerObstacle,
} from "@/lib/vinyl-game/engine";

type GamePhase = "entering" | "playing" | "paused" | "resuming" | "game-over" | "victory";
type Runtime = {
  lane: Lane;
  lanePosition: number;
  playerState: PlayerState;
  stateStarted: number;
  stateUntil: number;
  fastFallStartLift: number;
  fastFallCooldownUntil: number;
  speed: number;
  distance: number;
  avoided: number;
  lastFrame: number;
  lastHud: number;
  walls: AlbumWall[];
  obstacles: RunnerObstacle[];
  nextSpawnDistance: number;
  nextObjectId: number;
  lastWaveSignature: string;
};

type AlbumWall = { id: number; lane: Lane; depth: number; coverIndex: number; passed: boolean };
type WallAlbum = { cover: string | null; title: string };

const BEST_SCORE_KEY = "dol-ziklub-vinyl-runner-best";
const TARGET_FRAME_MS = 1000 / 60;
const FRAME_TOLERANCE_MS = 1.25;
const MAX_CANVAS_PIXELS = 2_200_000;
const LAUNCH_LOADING_MS = 950;
const ENTRY_TRANSITION_MS = 720;
const OBSTACLE_ASSET_PATHS: Record<ObstacleVariant, string> = {
  "blocker-a": "/game/obstacles/blocker-a.png",
  "blocker-b": "/game/obstacles/blocker-b.png",
  "low-barrier": "/game/obstacles/low-barrier.png",
  "overhead-barrier": "/game/obstacles/overhead-barrier.png",
};

function emptyRuntime(): Runtime {
  return {
    lane: 0,
    lanePosition: 0,
    playerState: "running",
    stateStarted: 0,
    stateUntil: 0,
    fastFallStartLift: 0,
    fastFallCooldownUntil: 0,
    speed: GAME.startSpeed,
    distance: 0,
    avoided: 0,
    lastFrame: 0,
    lastHud: 0,
    walls: [],
    obstacles: [],
    nextSpawnDistance: 5.5,
    nextObjectId: 0,
    lastWaveSignature: "",
  };
}

function spawnRandomWave(runtime: Runtime, albumCount: number) {
  let wave = createRunnerWave();
  let signature = runnerWaveSignature(wave);
  for (let attempt = 0; attempt < 4 && signature === runtime.lastWaveSignature; attempt += 1) {
    wave = createRunnerWave();
    signature = runnerWaveSignature(wave);
  }

  wave.forEach((item, index) => {
    const id = runtime.nextObjectId + index;
    if (item.kind === "album") {
      runtime.walls.push({ id, lane: item.lane, depth: 0.015, coverIndex: Math.floor(Math.random() * Math.max(1, albumCount)), passed: false });
    } else {
      runtime.obstacles.push(createObstacle(id, item.lane, item.variant));
    }
  });
  runtime.nextObjectId += wave.length;
  runtime.lastWaveSignature = signature;
  runtime.nextSpawnDistance = runtime.distance + randomWaveGap(runtime.speed);
}

function retainBeforeDepth<T extends { depth: number }>(items: T[], maximumDepth: number) {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < items.length; readIndex += 1) {
    const item = items[readIndex];
    if (item.depth < maximumDepth) items[writeIndex++] = item;
  }
  items.length = writeIndex;
}
type RoadPoint = { x: number; y: number; width: number };

function runnerPoint(lane: number, depth: number, width: number, height: number, runtime: Runtime): RoadPoint {
  const eased = Math.pow(depth, 1.55);
  const horizon = height * 0.19;
  const roadWidth = 18 + eased * width * 0.44;
  const farCurve = Math.pow(Math.max(0, (0.46 - depth) / 0.46), 1.85);
  const bend = width * (0.23 * farCurve + Math.sin(runtime.distance * 0.05) * 0.006 * farCurve);
  return { x: width * 0.5 + bend + lane * roadWidth * 0.46, y: horizon + eased * (height * 0.95 - horizon), width: roadWidth };
}function strokeGrooveCurve(ctx: CanvasRenderingContext2D, lane: number, startDepth: number, endDepth: number, width: number, height: number, runtime: Runtime) {
  const steps = Math.max(5, Math.min(18, Math.ceil((endDepth - startDepth) / 0.055)));
  const first = runnerPoint(lane, startDepth, width, height, runtime);
  ctx.beginPath(); ctx.moveTo(first.x, first.y);
  let previous = first;
  for (let step = 1; step <= steps; step += 1) {
    const depth = startDepth + (endDepth - startDepth) * (step / steps);
    const point = runnerPoint(lane, depth, width, height, runtime);
    const midpointX = (previous.x + point.x) / 2;
    const midpointY = (previous.y + point.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY);
    previous = point;
  }
  ctx.lineTo(previous.x, previous.y); ctx.stroke();
}function drawRunnerScene(ctx: CanvasRenderingContext2D, width: number, height: number, runtime: Runtime) {
  const horizon = height * 0.19;
  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  backdrop.addColorStop(0, "#040515"); backdrop.addColorStop(0.2, "#080a20"); backdrop.addColorStop(0.42, "#04050b"); backdrop.addColorStop(1, "#020203");
  ctx.fillStyle = backdrop; ctx.fillRect(0, 0, width, height);
  const nebula = ctx.createRadialGradient(width * 0.68, horizon * 0.28, 2, width * 0.68, horizon * 0.28, width * 0.52);
  nebula.addColorStop(0, "#4f39631d"); nebula.addColorStop(0.5, "#17285a15"); nebula.addColorStop(1, "#00000000");
  ctx.fillStyle = nebula; ctx.fillRect(0, 0, width, height * 0.58);
  for (let star = 0; star < 54; star += 1) {
    const x = ((star * 83) % 997) / 997 * width; const y = ((star * 47) % 173) / 173 * height * 0.46;
    const alpha = 0.2 + (star % 5) * 0.11; ctx.fillStyle = `rgba(220, 231, 255, ${alpha})`;
    ctx.beginPath(); ctx.arc(x, y, star % 9 === 0 ? 1.25 : 0.55, 0, Math.PI * 2); ctx.fill();
  }

  const left: RoadPoint[] = []; const right: RoadPoint[] = [];
  for (let depth = 0; depth <= 1; depth += 0.02) { left.push(runnerPoint(-5.2, depth, width, height, runtime)); right.push(runnerPoint(5.2, depth, width, height, runtime)); }
  const continuationInner: RoadPoint[] = []; const continuationOuter: RoadPoint[] = [];
  for (let depth = 0; depth <= 0.68; depth += 0.02) { continuationInner.push(runnerPoint(5.2, depth, width, height, runtime)); continuationOuter.push(runnerPoint(8.7, depth, width, height, runtime)); }
  ctx.save(); ctx.fillStyle = "#050506"; ctx.beginPath(); ctx.moveTo(continuationInner[0].x, continuationInner[0].y);
  for (const point of continuationInner) ctx.lineTo(point.x, point.y); for (let index = continuationOuter.length - 1; index >= 0; index -= 1) ctx.lineTo(continuationOuter[index].x, continuationOuter[index].y); ctx.closePath(); ctx.fill(); ctx.clip();
  for (let groove = 0; groove < 24; groove += 2) { const lane = 5.35 + groove * 0.12; ctx.strokeStyle = groove % 6 === 0 ? "#b89a6630" : "#c8c5be17"; ctx.lineWidth = groove % 6 === 0 ? 1.05 : 0.48; strokeGrooveCurve(ctx, lane, 0, 0.68, width, height, runtime); }
  ctx.restore();  const centerZoneInner: RoadPoint[] = []; const centerZoneOuter: RoadPoint[] = [];
  for (let depth = 0; depth <= 0.68; depth += 0.02) { centerZoneInner.push(runnerPoint(8.7, depth, width, height, runtime)); centerZoneOuter.push(runnerPoint(17.4, depth, width, height, runtime)); }
  ctx.fillStyle = "#050506"; ctx.beginPath(); ctx.moveTo(centerZoneInner[0].x, centerZoneInner[0].y);
  for (const point of centerZoneInner) ctx.lineTo(point.x, point.y); for (let index = centerZoneOuter.length - 1; index >= 0; index -= 1) ctx.lineTo(centerZoneOuter[index].x, centerZoneOuter[index].y); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(centerZoneInner[0].x, centerZoneInner[0].y); for (const point of centerZoneInner) ctx.lineTo(point.x, point.y); for (let index = centerZoneOuter.length - 1; index >= 0; index -= 1) ctx.lineTo(centerZoneOuter[index].x, centerZoneOuter[index].y); ctx.closePath(); ctx.clip();
  for (let groove = 0; groove < 74; groove += 2) { const lane = 8.78 + groove * 0.116; const majorGroove = groove % 6 === 0; ctx.strokeStyle = majorGroove ? "#b89a6630" : "#c8c5be17"; ctx.lineWidth = majorGroove ? 1.05 : 0.48; strokeGrooveCurve(ctx, lane, 0, 0.68, width, height, runtime); }
  const labelPoint = runnerPoint(15.35, 0.42, width, height, runtime); ctx.fillStyle = "#dd4935"; ctx.beginPath(); ctx.ellipse(labelPoint.x, labelPoint.y, width * 0.072, Math.max(3, height * 0.012), -0.13, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#f2b56e"; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = "#100606"; ctx.beginPath(); ctx.ellipse(labelPoint.x, labelPoint.y, 2.4, 1, -0.13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = "#050506"; ctx.beginPath(); ctx.moveTo(left[0].x, left[0].y); for (const point of left) ctx.lineTo(point.x, point.y); for (let index = right.length - 1; index >= 0; index -= 1) ctx.lineTo(right[index].x, right[index].y); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(left[0].x, left[0].y); for (const point of left) ctx.lineTo(point.x, point.y); for (let index = right.length - 1; index >= 0; index -= 1) ctx.lineTo(right[index].x, right[index].y); ctx.closePath(); ctx.clip();
  for (let groove = -52; groove <= 52; groove += 2) {
    const lane = groove * 0.1;
    const majorGroove = groove % 6 === 0;
    ctx.strokeStyle = majorGroove ? "#b89a6630" : "#c8c5be17";
    ctx.lineWidth = majorGroove ? 1.05 : 0.48;
    strokeGrooveCurve(ctx, lane, 0, 1, width, height, runtime);
  }
  ctx.restore();

  ctx.lineCap = "round";
  for (const [lane, color] of [[-1.5, "237, 76, 55"], [-0.5, "246, 239, 228"], [0.5, "246, 239, 228"], [1.5, "237, 76, 55"]] as const) {
    const guide = ctx.createLinearGradient(0, horizon, 0, height);
    guide.addColorStop(0, `rgba(${color}, 0)`); guide.addColorStop(0.24, `rgba(${color}, 0.08)`); guide.addColorStop(0.48, `rgba(${color}, 0.38)`); guide.addColorStop(0.76, `rgba(${color}, 0.76)`); guide.addColorStop(1, `rgba(${color}, 0.9)`);
    ctx.strokeStyle = guide; ctx.lineWidth = 3.6;
    strokeGrooveCurve(ctx, lane, 0, 1, width, height, runtime);
  }
  for (let speedMark = 0; speedMark < 18; speedMark += 1) {
    const depth = (speedMark * 0.137 + runtime.distance * (0.13 + (speedMark % 4) * 0.018)) % 1;
    const lane = ((speedMark * 17) % 35 - 17) * 0.12;
    const tail = Math.max(0, depth - 0.085 - (speedMark % 3) * 0.018);
    ctx.strokeStyle = `rgba(239, 203, 128, ${Math.pow(depth, 1.7) * 0.2})`; ctx.lineWidth = 0.55 + depth * 1.35;
    strokeGrooveCurve(ctx, lane, tail, depth, width, height, runtime);
  }
  for (let particle = 0; particle < 34; particle += 1) {
    const depth = (particle * 0.109 + runtime.distance * (0.22 + (particle % 3) * 0.03)) % 1;
    const lane = ((particle * 19) % 47 - 23) * 0.09;
    const point = runnerPoint(lane, depth, width, height, runtime);
    ctx.fillStyle = `rgba(235, 207, 155, ${Math.pow(depth, 2) * 0.22})`; ctx.beginPath(); ctx.arc(point.x, point.y, 0.45 + depth * 1.2, 0, Math.PI * 2); ctx.fill();
  }

  const boardGlow = runnerPoint(runtime.lanePosition, 0.82, width, height, runtime);
  const laneGlow = ctx.createRadialGradient(boardGlow.x, boardGlow.y + 22, 2, boardGlow.x, boardGlow.y + 22, width * 0.12);
  laneGlow.addColorStop(0, "#f0c87520"); laneGlow.addColorStop(1, "#f0c87500"); ctx.fillStyle = laneGlow; ctx.fillRect(boardGlow.x - width * 0.12, boardGlow.y - 18, width * 0.24, height * 0.2);
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, height * 0.18, width * 0.5, height * 0.5, width * 0.78);
  vignette.addColorStop(0, "#00000000"); vignette.addColorStop(0.75, "#00000015"); vignette.addColorStop(1, "#0000008a"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
}function drawAlbumWalls(ctx: CanvasRenderingContext2D, runtime: Runtime, albums: WallAlbum[], images: HTMLImageElement[], width: number, height: number) {
  const collisionDepth = GAME.collisionDepth - 0.055;
  const seamLeft = runnerPoint(-1.55, collisionDepth, width, height, runtime);
  const seamRight = runnerPoint(1.55, collisionDepth, width, height, runtime);
  ctx.save();
  ctx.strokeStyle = "rgba(240, 200, 117, 0.28)"; ctx.lineWidth = 1.25;
  ctx.beginPath(); ctx.moveTo(seamLeft.x, seamLeft.y); ctx.lineTo(seamRight.x, seamRight.y); ctx.stroke();
  for (const wall of runtime.walls) {
    const point = runnerPoint(wall.lane, wall.depth, width, height, runtime);
    const wallWidth = Math.max(13, point.width * (0.11 + wall.depth * 0.23));
    const wallHeight = wallWidth * 1.05;
    const x = point.x - wallWidth / 2;
    const y = point.y - wallHeight;
    ctx.save();
    const fadeStart = GAME.collisionDepth - 0.055;
    ctx.globalAlpha = wall.depth <= fadeStart
      ? 1
      : Math.max(0, 1 - (wall.depth - fadeStart) / (GAME.albumDespawnDepth - fadeStart));
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(x + wallWidth * 0.08, point.y - 2, wallWidth * 0.88, Math.max(3, wallWidth * 0.11));
    ctx.fillStyle = "#111115"; ctx.fillRect(x - 3, y - 3, wallWidth + 6, wallHeight + 6);
    const cover = images[wall.coverIndex];
    if (cover?.complete && cover.naturalWidth > 0) {
      ctx.drawImage(cover, x, y, wallWidth, wallHeight);
    } else {
      const fallback = albums[wall.coverIndex];
      ctx.fillStyle = wall.id % 2 === 0 ? "#df4b36" : "#234ac7"; ctx.fillRect(x, y, wallWidth, wallHeight);
      ctx.fillStyle = "#f6efe4"; ctx.font = `700 ${Math.max(7, wallWidth * 0.13)}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText((fallback?.title ?? "DOL ZIKLUB").slice(0, 14).toUpperCase(), point.x, y + wallHeight * 0.52, wallWidth * 0.88);
    }
    ctx.strokeStyle = "#f6efe4"; ctx.lineWidth = Math.max(0.7, wallWidth * 0.025); ctx.strokeRect(x, y, wallWidth, wallHeight);
    ctx.restore();
  }
  ctx.restore();
}
function drawGameObstacles(
  ctx: CanvasRenderingContext2D,
  runtime: Runtime,
  images: Partial<Record<ObstacleVariant, HTMLImageElement>>,
  width: number,
  height: number,
) {
  const fadeStart = GAME.collisionDepth - 0.035;

  for (const obstacle of runtime.obstacles) {
    const point = runnerPoint(obstacle.lane, obstacle.depth, width, height, runtime);
    const isLow = obstacle.variant === "low-barrier";
    const isOverhead = obstacle.variant === "overhead-barrier";
    const widthFactor = isOverhead ? 0.46 : isLow ? 0.31 : 0.27;
    const obstacleWidth = Math.max(22, point.width * widthFactor);
    const obstacleHeight = obstacleWidth * (isLow ? 0.58 : isOverhead ? 1.24 : 1.35);
    const overheadLift = isOverhead ? obstacleHeight * 0.28 : 0;
    const fade = obstacle.depth <= fadeStart
      ? 1
      : Math.max(0, 1 - (obstacle.depth - fadeStart) / (GAME.obstacleDespawnDepth - fadeStart));
    const image = images[obstacle.variant];

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + 2, obstacleWidth * 0.44, Math.max(3, obstacleWidth * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(point.x, point.y - overheadLift - obstacleHeight / 2);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -obstacleWidth / 2, -obstacleHeight / 2, obstacleWidth, obstacleHeight);
    } else {
      ctx.fillStyle = isLow ? "#d7f51d" : isOverhead ? "#4969ff" : "#e34a35";
      ctx.fillRect(-obstacleWidth / 2, -obstacleHeight / 2, obstacleWidth, obstacleHeight);
    }
    ctx.restore();
  }
}
function drawRunnerPlayer(ctx: CanvasRenderingContext2D, runtime: Runtime, image: HTMLImageElement | null, width: number, height: number, now: number) {
  const position = runnerPoint(runtime.lanePosition, 0.82, width, height, runtime);
  const active = runtime.playerState === "jumping" || runtime.playerState === "fast-falling" || runtime.playerState === "sliding";
  const progress = active ? actionProgress(now, runtime.stateStarted, runtime.stateUntil) : 0;
  const lift = playerLift(runtime.playerState, progress, runtime.fastFallStartLift) * height * 0.14;
  const crouch = slideBlend(runtime.playerState, progress);
  const shadowWidth = 42 + crouch * 11;
  const shadowHeight = 11 - crouch * 3;

  ctx.save();
  ctx.fillStyle = "#000000b8";
  ctx.beginPath();
  ctx.ellipse(position.x, position.y + 14, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e3b967";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  for (let spark = 0; spark < 7; spark += 1) {
    const x = position.x - 10 + spark * 3;
    const y = position.y + 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5 - spark, y + 8 + ((runtime.distance * 23 + spark) % 5));
    ctx.stroke();
  }
  ctx.translate(position.x, position.y - lift + Math.sin(runtime.distance * 28) * 1.2);
  ctx.rotate((runtime.lanePosition - runtime.lane) * -0.13);
  ctx.scale(1 + crouch * 0.2, 1 - crouch * 0.35);
  if (image?.complete && image.naturalWidth > 0) {
    const naturalAspect = image.naturalHeight / image.naturalWidth;
    const spriteHeight = Math.min(height * 0.31, width * 0.34 * naturalAspect);
    const spriteWidth = spriteHeight / naturalAspect;
    ctx.drawImage(image, -spriteWidth / 2, -spriteHeight + 12, spriteWidth, spriteHeight);
  } else {
    ctx.fillStyle = "#f6efe4";
    ctx.fillRect(-18, -68, 36, 48);
    ctx.fillStyle = "#e13f2a";
    ctx.fillRect(-28, -20, 56, 9);
    ctx.beginPath();
    ctx.arc(0, -82, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
export function HeroVinylGame({ wallAlbums }: { wallAlbums: WallAlbum[] }) {
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("entering");
  const [hud, setHud] = useState({ score: 0, distance: 0, best: 0, speed: 1 });
  const [resumeCountdown, setResumeCountdown] = useState(3);
  const [muted, setMuted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const characterRef = useRef<HTMLImageElement | null>(null);
  const wallImagesRef = useRef<HTMLImageElement[]>([]);
  const obstacleImagesRef = useRef<Partial<Record<ObstacleVariant, HTMLImageElement>>>({});
  const phaseRef = useRef<GamePhase>("entering");
  const runtimeRef = useRef<Runtime>(emptyRuntime());
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const updatePhase = useCallback((next: GamePhase) => { phaseRef.current = next; setPhase(next); }, []);
  const clearTimer = useCallback(() => { if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; } }, []);
  const stopAudio = useCallback(() => { const audio = audioRef.current; if (audio) { audio.pause(); audio.currentTime = 0; } }, []);

  const action = useCallback((kind: "left" | "right" | "jump" | "slide") => {
    if (phaseRef.current !== "playing") return;
    const runtime = runtimeRef.current;
    if (kind === "left" || kind === "right") {
      runtime.lane = nextLane(runtime.lane, kind === "left" ? -1 : 1);
      return;
    }

    const now = performance.now();
    if (kind === "slide" && runtime.playerState === "jumping") {
      if (now < runtime.fastFallCooldownUntil) return;
      const progress = actionProgress(now, runtime.stateStarted, runtime.stateUntil);
      runtime.fastFallStartLift = playerLift("jumping", progress);
      runtime.playerState = "fast-falling";
      runtime.stateStarted = now;
      runtime.stateUntil = now + GAME.fastFallDuration;
      runtime.fastFallCooldownUntil = now + GAME.fastFallCooldown;
      return;
    }

    if (runtime.playerState !== "running") return;
    runtime.playerState = kind === "jump" ? "jumping" : "sliding";
    runtime.stateStarted = now;
    runtime.stateUntil = now + (kind === "jump" ? GAME.jumpDuration : GAME.slideDuration);
    runtime.fastFallStartLift = 0;
    if (kind === "jump") runtime.fastFallCooldownUntil = now + GAME.fastFallInputDelay;
  }, []);

  const startCountdown = useCallback(() => {
    clearTimer();
    runtimeRef.current = emptyRuntime();
    setHud((current) => ({ score: 0, distance: 0, best: current.best, speed: 1 }));
    const audio = audioRef.current;
    if (audio) { audio.currentTime = 0; audio.muted = muted; void audio.play().catch(() => undefined); }
    runtimeRef.current.lastFrame = performance.now();
    updatePhase("playing");
  }, [clearTimer, muted, updatePhase]);

  const finishRun = useCallback((outcome: "game-over" | "victory") => {
    if (phaseRef.current !== "playing") return;
    const runtime = runtimeRef.current;
    if (outcome === "game-over") runtime.playerState = "hit";
    const distance = Math.floor(runtime.distance * 10);
    const score = distance + runtime.avoided * GAME.avoidedObstacleBonus;
    const best = Math.max(score, Number(window.localStorage.getItem(BEST_SCORE_KEY) ?? 0));
    window.localStorage.setItem(BEST_SCORE_KEY, String(best));
    audioRef.current?.pause();
    setHud((current) => ({ ...current, score, distance, best }));
    updatePhase(outcome);
  }, [updatePhase]);

  const crash = useCallback(() => finishRun("game-over"), [finishRun]);
  const win = useCallback(() => finishRun("victory"), [finishRun]);

  const close = useCallback(() => {
    clearTimer();
    stopAudio();
    setOpen(false);
    setLaunching(false);
    runtimeRef.current = emptyRuntime();
  }, [clearTimer, stopAudio]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing" && phaseRef.current !== "resuming") return;
    clearTimer();
    audioRef.current?.pause();
    updatePhase("paused");
  }, [clearTimer, updatePhase]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    clearTimer();
    setResumeCountdown(3);
    updatePhase("resuming");
    let next = 3;
    timerRef.current = window.setInterval(() => {
      next -= 1;
      if (next <= 0) {
        clearTimer();
        const audio = audioRef.current;
        if (audio) { audio.muted = muted; void audio.play().catch(() => undefined); }
        runtimeRef.current.lastFrame = performance.now();
        updatePhase("playing");
        return;
      }
      setResumeCountdown(next);
    }, 700);
  }, [clearTimer, muted, updatePhase]);

  const openGame = useCallback(() => {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(() => {
      setOpen(true);
      updatePhase("entering");
      window.setTimeout(() => { startCountdown(); setLaunching(false); }, ENTRY_TRANSITION_MS);
    }, LAUNCH_LOADING_MS);
  }, [launching, startCountdown, updatePhase]);

  useEffect(() => {
    const image = new Image();
    image.src = "/game/character/wheely.png";
    characterRef.current = image;
    return () => { characterRef.current = null; };
  }, []);

  useEffect(() => {
    wallImagesRef.current = wallAlbums.map((album) => {
      const image = new Image();
      if (album.cover) image.src = album.cover;
      return image;
    });
  }, [wallAlbums]);

  useEffect(() => {
    if (!launching && !open) return;
    const images: Partial<Record<ObstacleVariant, HTMLImageElement>> = {};
    for (const variant of OBSTACLE_VARIANTS) {
      const image = new Image();
      image.src = OBSTACLE_ASSET_PATHS[variant];
      images[variant] = image;
    }
    obstacleImagesRef.current = images;
    return () => { obstacleImagesRef.current = {}; };
  }, [launching, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const gameKey = ["q", "d", "z", "s", "arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key);
      if (gameKey) event.preventDefault();
      if (event.key === "Escape") close();
      else if (key === "q" || key === "arrowleft") action("left");
      else if (key === "d" || key === "arrowright") action("right");
      else if (key === "z" || key === "arrowup" || key === " ") { if (phaseRef.current === "paused") resume(); else action("jump"); }
      else if (key === "s" || key === "arrowdown") action("slide");
    };
    const onBlur = () => pause();
    const onVisibility = () => { if (document.hidden) pause(); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onVisibility); };
  }, [action, close, open, pause, resume]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;
    let width = 0; let height = 0; let dpr = 1;
    let lastPaint = 0;
    let idlePainted = false;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const safePixelRatio = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height));
      dpr = Math.max(0.75, Math.min(pixelRatio, safePixelRatio));
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      idlePainted = false;
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const frame = (now: number) => {
      const runtime = runtimeRef.current;
      const isAnimating = phaseRef.current === "playing";
      if (isAnimating && lastPaint > 0 && now - lastPaint < TARGET_FRAME_MS - FRAME_TOLERANCE_MS) {
        frameRef.current = requestAnimationFrame(frame);
        return;
      }
      if (isAnimating) {
        const dt = Math.min(0.05, Math.max(0, (now - runtime.lastFrame) / 1000));
        runtime.lastFrame = now;
        runtime.speed = Math.min(GAME.maxSpeed, runtime.speed + GAME.acceleration * dt);
        runtime.distance += runtime.speed * dt * 10;
        runtime.lanePosition += (runtime.lane - runtime.lanePosition) * Math.min(1, dt * 12);
        if (runtime.playerState !== "running" && runtime.playerState !== "hit" && now >= runtime.stateUntil) runtime.playerState = "running";
        if (runtime.distance >= runtime.nextSpawnDistance) {
          spawnRandomWave(runtime, wallAlbums.length);
        }
        for (const wall of runtime.walls) {
          const visualVelocity = 0.17 + runtime.speed * 0.35;
          const perspectiveCompensation = 1 / Math.max(0.9, 1.55 * Math.pow(Math.max(wall.depth, 0.16), 0.55));
          wall.depth += dt * visualVelocity * perspectiveCompensation * (wall.passed ? GAME.passedDepthMultiplier : 1);
          if (!wall.passed && wall.depth >= GAME.collisionDepth - 0.055) {
            wall.passed = true;
            if (Math.abs(runtime.lanePosition - wall.lane) < 0.24) { crash(); break; }
            runtime.avoided += 1;
          }
        }
        retainBeforeDepth(runtime.walls, GAME.albumDespawnDepth);
        for (const obstacle of runtime.obstacles) {
          const visualVelocity = 0.18 + runtime.speed * 0.36;
          const perspectiveCompensation = 1 / Math.max(0.9, 1.55 * Math.pow(Math.max(obstacle.depth, 0.16), 0.55));
          obstacle.depth += dt * visualVelocity * perspectiveCompensation * (obstacle.cleared ? GAME.passedDepthMultiplier : 1);
          if (!obstacle.cleared && obstacle.depth >= GAME.collisionDepth - 0.035) {
            obstacle.cleared = true;
            const sameLane = Math.abs(runtime.lanePosition - obstacle.lane) < 0.24;
            if (!playerClearsObstacle(obstacle, sameLane, runtime.playerState)) { crash(); break; }
            runtime.avoided += 1;
          }
        }
        retainBeforeDepth(runtime.obstacles, GAME.obstacleDespawnDepth);
        if (now - runtime.lastHud > 130) {
          runtime.lastHud = now;
          const distance = Math.floor(runtime.distance * 10);
          const score = distance + runtime.avoided * GAME.avoidedObstacleBonus;
          setHud((current) => ({ score, distance, best: Math.max(current.best, Number(window.localStorage.getItem(BEST_SCORE_KEY) ?? 0)), speed: Number((runtime.speed / GAME.startSpeed).toFixed(1)) }));
        }
      }
      const shouldPaint = isAnimating || !idlePainted;
      if (shouldPaint) {
        lastPaint = now;
        idlePainted = !isAnimating;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        drawRunnerScene(ctx, width, height, runtime);
        drawAlbumWalls(ctx, runtime, wallAlbums, wallImagesRef.current, width, height);
        drawGameObstacles(ctx, runtime, obstacleImagesRef.current, width, height);
        drawRunnerPlayer(ctx, runtime, characterRef.current, width, height, now);
      }
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    return () => { observer.disconnect(); if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); frameRef.current = null; };
  }, [crash, open, wallAlbums]);

  useEffect(() => () => { clearTimer(); stopAudio(); }, [clearTimer, stopAudio]);

  const toggleMuted = () => { const next = !muted; setMuted(next); if (audioRef.current) audioRef.current.muted = next; };
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => { touchRef.current = { x: event.clientX, y: event.clientY }; };
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = touchRef.current; touchRef.current = null;
    if (!start || phaseRef.current !== "playing") return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { action("jump"); return; }
    if (Math.abs(dx) > Math.abs(dy)) action(dx < 0 ? "left" : "right"); else action(dy < 0 ? "jump" : "slide");
  };

  return <>
    <button className={`hero-vinyl-button${launching ? " is-launching" : ""}`} type="button" onClick={openGame} aria-label="Ouvrir le mini-jeu Wheely">
      <span className="hero-vinyl-button__disc" aria-hidden="true" />
    </button>
    {launching && !open ? <div className="wheely-launch-loader" role="status" aria-live="polite" aria-label="Chargement du mini-jeu Wheely">
      <span className="wheely-launch-loader__disc" aria-hidden="true" />
      <span className="wheely-launch-loader__track" aria-hidden="true">
        <NextImage className="wheely-launch-loader__rider" src="/game/transition/wheely-loading.png" alt="" width={512} height={512} priority />
      </span>
      <span className="wheely-launch-loader__label">WHEELY SE MET EN PISTE…</span>
    </div> : null}    {open ? <section className={`vinyl-runner vinyl-runner--${phase}`} aria-label="Wheely sur le vinyle">
      <audio ref={audioRef} src="/game/music/wheely-opening.m4a" preload="auto" onEnded={win} />
      <canvas ref={canvasRef} className="vinyl-runner__canvas" onPointerDown={onPointerDown} onPointerUp={onPointerUp} />
      <header className="vinyl-runner__hud" aria-live="polite"><span>SCORE <b>{hud.score}</b></span><span>DISTANCE <b>{hud.distance} M</b></span><span>VITESSE <b>{hud.speed}X</b></span><span>BEST <b>{hud.best}</b></span></header>
      <div className="vinyl-runner__actions"><button type="button" onClick={toggleMuted} aria-label={muted ? "Activer le son" : "Couper le son"}>{muted ? "SON OFF" : "SON ON"}</button><button type="button" onClick={pause} aria-label="Mettre le jeu en pause">PAUSE</button><button type="button" onClick={close} aria-label="Quitter le mini-jeu">SORTIR ×</button></div>
      {phase === "entering" ? <div className="vinyl-runner__entry" aria-hidden="true" /> : null}
      {phase === "resuming" ? <div className="vinyl-runner__countdown" aria-live="assertive">{resumeCountdown}</div> : null}
      {phase === "paused" ? <div className="vinyl-runner__panel vinyl-runner__panel--small"><p className="eyebrow">SILLON EN PAUSE</p><h2>On reprend<br /><em>quand tu veux.</em></h2><button type="button" className="vinyl-runner__primary" onClick={resume}>Reprendre →</button></div> : null}
      {phase === "game-over" ? <div className="vinyl-runner__panel vinyl-runner__panel--small"><p className="eyebrow">FIN DE PISTE</p><h2>Le disque t’a rayé.</h2><div className="vinyl-runner__summary" aria-label={`Score ${hud.score} points, distance ${hud.distance} mètres`}><div><span>SCORE</span><b>{hud.score}</b><small>POINTS</small></div><div><span>DISTANCE</span><b>{hud.distance}</b><small>MÈTRES</small></div></div><button type="button" className="vinyl-runner__primary" onClick={startCountdown}>Rejouer →</button><button type="button" className="vinyl-runner__return" onClick={close}>Retour au Ziklub</button></div> : null}
      {phase === "victory" ? <div className="vinyl-runner__panel vinyl-runner__panel--small vinyl-runner__panel--victory"><p className="eyebrow">DISQUE TERMINÉ</p><h2>Tu as bouclé<br /><em>la face entière.</em></h2><div className="vinyl-runner__summary" aria-label={`Victoire, score ${hud.score} points, distance ${hud.distance} mètres`}><div><span>SCORE FINAL</span><b>{hud.score}</b><small>POINTS</small></div><div><span>DISTANCE</span><b>{hud.distance}</b><small>MÈTRES</small></div></div><button type="button" className="vinyl-runner__primary" onClick={startCountdown}>Rejouer →</button><button type="button" className="vinyl-runner__return" onClick={close}>Retour au Ziklub</button></div> : null}
    </section> : null}
  </>;
}
