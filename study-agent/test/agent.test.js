import test from "node:test";
import assert from "node:assert/strict";

import { runStudyAgent } from "../agent.js";

test("demo agent allocates every available session", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await runStudyAgent("I have 3 hours. Use 25-minute sessions.");
    const allocatedSessions = [...result.answer.matchAll(/— (\d+) session\(s\)/g)]
      .map((match) => Number(match[1]))
      .reduce((total, sessions) => total + sessions, 0);

    assert.equal(result.mode, "demo");
    assert.equal(allocatedSessions, 7);
  } finally {
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
  }
});
