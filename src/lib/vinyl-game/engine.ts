export type Lane = -1 | 0 | 1;
export type PlayerState = "running" | "jumping" | "fast-falling" | "sliding" | "hit";
export type ObstacleAction = "switch-lane" | "jump" | "slide";
export type ObstacleVariant = "blocker-a" | "blocker-b" | "low-barrier" | "overhead-barrier";

export type RunnerObstacle = {
  id: number;
  lane: Lane;
  depth: number;
  action: ObstacleAction;
  variant: ObstacleVariant;
  cleared: boolean;
};

export const LANES: Lane[] = [-1, 0, 1];
export const OBSTACLE_VARIANTS: ObstacleVariant[] = ["blocker-a", "blocker-b", "low-barrier", "overhead-barrier"];
export const ACTION_OBSTACLE_VARIANTS: ObstacleVariant[] = ["low-barrier", "overhead-barrier"];
export const BLOCKER_OBSTACLE_VARIANTS: ObstacleVariant[] = ["blocker-a", "blocker-b"];
export type RunnerWaveItem =
  | { kind: "album"; lane: Lane }
  | { kind: "obstacle"; lane: Lane; variant: ObstacleVariant };

export const GAME = {
  startSpeed: 0.215,
  maxSpeed: 0.46,
  acceleration: 0.008,
  jumpDuration: 620,
  slideDuration: 620,
  fastFallInputDelay: 90,
  fastFallDuration: 230,
  fastFallCooldown: 360,
  passedDepthMultiplier: 3.2,
  avoidedObstacleBonus: 25,
  collisionDepth: 0.84,
  collisionWindow: 0.085,
  albumDespawnDepth: 0.83,
  obstacleDespawnDepth: 0.85,
  minWaveGap: 2.55,
  maxWaveGap: 4.25,
} as const;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function actionProgress(now: number, startedAt: number, endsAt: number) {
  return clamp((now - startedAt) / Math.max(1, endsAt - startedAt), 0, 1);
}

export function playerLift(state: PlayerState, progress: number, fastFallStartLift = 0) {
  const safeProgress = clamp(progress, 0, 1);
  if (state === "jumping") return Math.sin(safeProgress * Math.PI);
  if (state === "fast-falling") {
    const eased = safeProgress * safeProgress * (3 - 2 * safeProgress);
    return fastFallStartLift * (1 - eased);
  }
  return 0;
}

export function slideBlend(state: PlayerState, progress: number) {
  return state === "sliding" ? Math.sin(clamp(progress, 0, 1) * Math.PI) : 0;
}
export function laneFrom(value: number): Lane {
  return value < -0.5 ? -1 : value > 0.5 ? 1 : 0;
}

export function nextLane(current: Lane, direction: -1 | 1): Lane {
  return laneFrom(clamp(current + direction, -1, 1));
}

export function obstacleActionForVariant(variant: ObstacleVariant): ObstacleAction {
  if (variant === "low-barrier") return "jump";
  if (variant === "overhead-barrier") return "slide";
  return "switch-lane";
}

export function createObstacle(id: number, lane: Lane, variant: ObstacleVariant): RunnerObstacle {
  return { id, lane, depth: 0.015, action: obstacleActionForVariant(variant), variant, cleared: false };
}

export function playerClearsObstacle(obstacle: RunnerObstacle, sameLane: boolean, state: PlayerState) {
  if (!sameLane) return true;
  if (obstacle.action === "jump") return state === "jumping" || state === "fast-falling";
  if (obstacle.action === "slide") return state === "sliding";
  return false;
}

function shuffledLanes(random: () => number) {
  const lanes = [...LANES];
  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [lanes[index], lanes[target]] = [lanes[target], lanes[index]];
  }
  return lanes;
}

function pickVariant(variants: ObstacleVariant[], random: () => number) {
  return variants[Math.min(variants.length - 1, Math.floor(random() * variants.length))];
}

export function createRunnerWave(random = Math.random): RunnerWaveItem[] {
  const lanes = shuffledLanes(random);
  if (random() < 0.38) {
    const action: RunnerWaveItem = { kind: "obstacle", lane: lanes[0], variant: pickVariant(ACTION_OBSTACLE_VARIANTS, random) };
    const blockers: RunnerWaveItem[] = lanes.slice(1).map((lane) => random() < 0.58
      ? { kind: "album", lane }
      : { kind: "obstacle", lane, variant: pickVariant(BLOCKER_OBSTACLE_VARIANTS, random) });
    return [action, ...blockers];
  }

  const count = random() < 0.46 ? 2 : 1;
  if (random() < 0.3) return lanes.slice(0, count).map((lane) => ({ kind: "album", lane }));
  return lanes.slice(0, count).map((lane) => ({ kind: "obstacle", lane, variant: pickVariant(OBSTACLE_VARIANTS, random) }));
}

export function runnerWaveSignature(wave: RunnerWaveItem[]) {
  return wave.map((item) => `${item.kind}-${item.lane}-${item.kind === "obstacle" ? item.variant : "cover"}`).sort().join("|");
}

export function randomWaveGap(speed: number, random = Math.random) {
  const speedProgress = clamp((speed - GAME.startSpeed) / (GAME.maxSpeed - GAME.startSpeed), 0, 1);
  const maximum = GAME.maxWaveGap - speedProgress * 0.9;
  return GAME.minWaveGap + random() * (maximum - GAME.minWaveGap);
}

export function obstaclePerspective(depth: number, width: number, height: number) {
  const t = clamp(depth, 0, 1);
  const eased = Math.pow(t, 1.72);
  return { y: height * 0.19 + eased * height * 0.76, laneWidth: 25 + eased * width * 0.3, scale: 0.14 + eased * 1.15 };
}