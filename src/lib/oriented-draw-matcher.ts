export type DrawParticipant = {
  id: string;
  username: string;
  displayName?: string | null;
};

export type OrientedPairHistory = {
  proposerId: string;
  listenerId: string;
  drawNumber: number;
};

export type OrientedDrawAssignment = {
  proposer: DrawParticipant;
  listener: DrawParticipant;
  previousCount: number;
  previousDraws: number[];
};

export type OrientedDrawResult = {
  assignments: OrientedDrawAssignment[];
  repeatedPairCount: number;
  warning: string | null;
};

const MAX_PARTICIPANTS = 18;
const REPEAT_COST = 1_000_000_000;
const RECENCY_COST = 10_000;

function edgeTieBreaker(proposerId: string, listenerId: string, seed: number) {
  let hash = seed | 0;
  for (const character of `${proposerId}>${listenerId}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return Math.abs(hash % 997);
}

export function matchOrientedDraw(
  participants: DrawParticipant[],
  history: OrientedPairHistory[],
  seed = 0,
): OrientedDrawResult {
  if (participants.length < 2) throw new Error("Au moins deux participants sont nécessaires.");
  if (participants.length > MAX_PARTICIPANTS) throw new Error(`Le tirage est limité à ${MAX_PARTICIPANTS} participants.`);
  const ids = new Set(participants.map((participant) => participant.id));
  if (ids.size !== participants.length || participants.some((participant) => !participant.id || !participant.username.trim())) {
    throw new Error("Chaque participant doit posséder un identifiant stable et unique.");
  }

  const historyByPair = new Map<string, number[]>();
  for (const pair of history) {
    if (!ids.has(pair.proposerId) || !ids.has(pair.listenerId) || pair.proposerId === pair.listenerId) continue;
    const key = `${pair.proposerId}>${pair.listenerId}`;
    historyByPair.set(key, [...(historyByPair.get(key) ?? []), pair.drawNumber].sort((a, b) => a - b));
  }

  const size = participants.length;
  const stateCount = 1 << size;
  const costs = new Float64Array(stateCount);
  const previousMasks = new Int32Array(stateCount);
  const chosenListeners = new Int16Array(stateCount);
  costs.fill(Number.POSITIVE_INFINITY);
  previousMasks.fill(-1);
  chosenListeners.fill(-1);
  costs[0] = 0;

  for (let mask = 0; mask < stateCount; mask += 1) {
    if (!Number.isFinite(costs[mask])) continue;
    const proposerIndex = mask.toString(2).replaceAll("0", "").length;
    if (proposerIndex >= size) continue;
    const proposer = participants[proposerIndex];
    for (let listenerIndex = 0; listenerIndex < size; listenerIndex += 1) {
      if ((mask & (1 << listenerIndex)) !== 0 || listenerIndex === proposerIndex) continue;
      const listener = participants[listenerIndex];
      const previousDraws = historyByPair.get(`${proposer.id}>${listener.id}`) ?? [];
      const lastDraw = previousDraws.at(-1) ?? 0;
      const edgeCost = previousDraws.length * REPEAT_COST
        + lastDraw * RECENCY_COST
        + edgeTieBreaker(proposer.id, listener.id, seed);
      const nextMask = mask | (1 << listenerIndex);
      const nextCost = costs[mask] + edgeCost;
      if (nextCost < costs[nextMask]) {
        costs[nextMask] = nextCost;
        previousMasks[nextMask] = mask;
        chosenListeners[nextMask] = listenerIndex;
      }
    }
  }

  const fullMask = stateCount - 1;
  if (!Number.isFinite(costs[fullMask])) throw new Error("Aucune affectation complète sans auto-duo n’est possible.");
  const listenerIndexes = new Array<number>(size);
  let mask = fullMask;
  for (let proposerIndex = size - 1; proposerIndex >= 0; proposerIndex -= 1) {
    listenerIndexes[proposerIndex] = chosenListeners[mask];
    mask = previousMasks[mask];
  }

  const assignments = participants.map((proposer, index) => {
    const listener = participants[listenerIndexes[index]];
    const previousDraws = historyByPair.get(`${proposer.id}>${listener.id}`) ?? [];
    return { proposer, listener, previousCount: previousDraws.length, previousDraws };
  });
  const repeated = assignments.filter((assignment) => assignment.previousCount > 0);
  const oldestRepeatedDraw = repeated.flatMap((assignment) => assignment.previousDraws).sort((a, b) => a - b)[0];
  const warning = repeated.length === 0
    ? null
    : `Aucun tirage entièrement inédit n’est possible. Cette proposition contient ${repeated.length} relation${repeated.length > 1 ? "s" : ""} déjà utilisée${repeated.length > 1 ? "s" : ""}${oldestRepeatedDraw ? `, dont la plus ancienne date du tirage ${oldestRepeatedDraw}` : ""}.`;

  return { assignments, repeatedPairCount: repeated.length, warning };
}
