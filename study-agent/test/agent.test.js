import test from "node:test";
import assert from "node:assert/strict";

import { prepareResponseOutputForInput, runStudyAgent, streamStudyAgent } from "../agent.js";
import { getProvider } from "../providers.js";

async function withDemoProvider(run) {
  const provider = getProvider("Default");
  const originalApiKey = provider.apiKey;
  provider.apiKey = "";

  try {
    return await run();
  } finally {
    provider.apiKey = originalApiKey;
  }
}

test("demo agent allocates every available session", async () => {
  await withDemoProvider(async () => {
    const result = await runStudyAgent("I have 3 hours. Use 25-minute sessions.");
    const allocatedSessions = [...result.answer.matchAll(/— (\d+) session\(s\)/g)]
      .map((match) => Number(match[1]))
      .reduce((total, sessions) => total + sessions, 0);

    assert.equal(result.mode, "demo");
    assert.equal(allocatedSessions, 7);
  });
});

test("demo agent streams metadata, trace, text, and a final result", async () => {
  await withDemoProvider(async () => {
    const events = [];
    for await (const event of streamStudyAgent("I have 1 hour. Use 20-minute sessions.")) {
      events.push(event);
    }

    const doneEvent = events.at(-1);
    const streamedAnswer = events
      .filter((event) => event.type === "text.delta")
      .map((event) => event.delta)
      .join("");
    const streamedTrace = events.filter((event) => event.type === "trace");

    assert.equal(events[0].type, "agent.started");
    assert.equal(doneEvent.type, "done");
    assert.equal(streamedAnswer, doneEvent.result.answer);
    assert.equal(streamedTrace.length, doneEvent.result.trace.length);
    assert.equal(doneEvent.result.answer.includes("3 complete 20-minute sessions"), true);
  });
});

test("removes SDK-only parsed fields before the next model request", () => {
  const output = prepareResponseOutputForInput([
    {
      type: "function_call",
      call_id: "call_123",
      name: "save_learning_goal",
      arguments: '{"goal":"agents"}',
      parsed_arguments: { goal: "agents" },
    },
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Working", parsed: null }],
    },
  ]);

  assert.equal("parsed_arguments" in output[0], false);
  assert.equal("parsed" in output[1].content[0], false);
  assert.equal(output[0].arguments, '{"goal":"agents"}');
  assert.equal(output[1].content[0].text, "Working");
});
