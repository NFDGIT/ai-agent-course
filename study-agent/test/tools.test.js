import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateStudySessions,
  readMemory,
  resetMemory,
  saveLearningGoal,
} from "../tools.js";

test("calculates complete study sessions", () => {
  assert.deepEqual(
    calculateStudySessions({ hours: 3, session_minutes: 25 }),
    {
      total_minutes: 180,
      sessions: 7,
      session_minutes: 25,
      unused_minutes: 5,
    },
  );
});

test("rejects invalid time values", () => {
  assert.throws(
    () => calculateStudySessions({ hours: 0, session_minutes: 25 }),
    /hours must be a positive number/,
  );
});

test("saves the learning goal in memory", () => {
  resetMemory();
  saveLearningGoal({ goal: "Learn AI agents" });
  assert.deepEqual(readMemory(), { learningGoal: "Learn AI agents" });
});
