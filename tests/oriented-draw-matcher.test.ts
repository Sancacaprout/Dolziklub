import assert from "node:assert/strict";
import test from "node:test";
import { matchOrientedDraw, type DrawParticipant } from "../src/lib/oriented-draw-matcher";

const participants = (names: string[]): DrawParticipant[] => names.map((username) => ({ id: `id-${username}`, username }));

test("builds a complete directed assignment without self-pairs", () => {
  const result = matchOrientedDraw(participants(["a", "b", "c", "d"]), []);
  assert.equal(result.assignments.length, 4);
  assert.equal(new Set(result.assignments.map((pair) => pair.proposer.id)).size, 4);
  assert.equal(new Set(result.assignments.map((pair) => pair.listener.id)).size, 4);
  assert.ok(result.assignments.every((pair) => pair.proposer.id !== pair.listener.id));
  assert.equal(result.warning, null);
});

test("treats A to B and B to A as different relations", () => {
  const roster = participants(["a", "b", "c"]);
  const result = matchOrientedDraw(roster, [{ proposerId: "id-a", listenerId: "id-b", drawNumber: 1 }]);
  assert.ok(!result.assignments.some((pair) => pair.proposer.id === "id-a" && pair.listener.id === "id-b"));
  assert.equal(result.repeatedPairCount, 0);
});

test("uses the exact minimum-repeat fallback and reports the oldest relation", () => {
  const roster = participants(["a", "b", "c"]);
  const history = roster.flatMap((proposer) => roster
    .filter((listener) => listener.id !== proposer.id)
    .map((listener, index) => ({ proposerId: proposer.id, listenerId: listener.id, drawNumber: index + 2 })));
  const result = matchOrientedDraw(roster, history);
  assert.equal(result.repeatedPairCount, 3);
  assert.match(result.warning ?? "", /3 relations déjà utilisées/);
  assert.match(result.warning ?? "", /tirage 2/);
});

test("rejects unstable or duplicate participant identities", () => {
  assert.throws(() => matchOrientedDraw([{ id: "same", username: "a" }, { id: "same", username: "b" }], []), /identifiant stable/);
});
