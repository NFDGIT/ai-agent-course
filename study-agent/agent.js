import OpenAI from "openai";

import { executeTool, saveLearningGoal, toolDefinitions } from "./tools.js";

const instructions = `
You are a beginner-friendly Study Planner Agent.

Your job is to turn a learning goal into a small, practical study plan.

Rules:
- Explain the plan in simple language.
- Use calculate_study_sessions when the request includes available hours and session length.
- Use save_learning_goal before producing the final plan.
- Never claim a tool succeeded until you receive its output.
- Keep the final answer concise and actionable.
`;

function createClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function addTrace(trace, type, title, detail) {
  trace.push({ type, title, detail });
}

function extractNumber(pattern, text, fallback) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : fallback;
}

function runDemoAgent(message) {
  const trace = [];
  const hours = extractNumber(/(\d+(?:\.\d+)?)\s*hours?/i, message, 2);
  const sessionMinutes = extractNumber(/(\d+)\s*(?:minute|min)/i, message, 25);

  addTrace(trace, "decision", "Understand the goal", "The request asks for a timed learning plan.");
  addTrace(trace, "tool", "Call calculate_study_sessions", `${hours} hours, ${sessionMinutes}-minute sessions`);

  const totalMinutes = Math.round(hours * 60);
  const sessions = Math.max(1, Math.floor(totalMinutes / sessionMinutes));
  addTrace(trace, "observation", "Receive calculator result", `${sessions} complete sessions are available.`);

  const goal = message.trim();
  saveLearningGoal({ goal });
  addTrace(trace, "tool", "Call save_learning_goal", "The goal is saved in temporary memory.");
  addTrace(trace, "final", "Produce the answer", "Use the tool results to create the plan.");

  const stages = [
    "Understand the core idea",
    "Follow one guided example",
    "Build the smallest working version",
    "Change one feature yourself",
    "Review what each part does",
  ];

  const baseSessions = Math.floor(sessions / stages.length);
  const extraSessions = sessions % stages.length;
  const plan = stages
    .map((stage, index) => ({
      stage,
      sessions: baseSessions + (index < extraSessions ? 1 : 0),
    }))
    .filter((stage) => stage.sessions > 0)
    .map((stage, index) => `${index + 1}. ${stage.stage} — ${stage.sessions} session(s)`)
    .join("\n");

  return {
    mode: "demo",
    answer: `You have ${sessions} complete ${sessionMinutes}-minute sessions.\n\n${plan}`,
    trace,
  };
}

export async function runStudyAgent(message) {
  const client = createClient();
  if (!client) return runDemoAgent(message);

  const trace = [];
  const input = [{ role: "user", content: message }];
  const model = process.env.OPENAI_MODEL || "gpt-5.4";

  for (let step = 0; step < 6; step += 1) {
    addTrace(trace, "decision", `Model turn ${step + 1}`, "Ask the model for the next response or action.");

    const response = await client.responses.create({
      model,
      instructions,
      tools: toolDefinitions,
      input,
    });

    input.push(...response.output);
    const functionCalls = response.output.filter((item) => item.type === "function_call");

    if (functionCalls.length === 0) {
      addTrace(trace, "final", "Final answer", "The model finished without requesting another tool.");
      return {
        mode: "openai",
        answer: response.output_text,
        trace,
      };
    }

    for (const functionCall of functionCalls) {
      const argumentsObject = JSON.parse(functionCall.arguments);
      addTrace(trace, "tool", `Call ${functionCall.name}`, JSON.stringify(argumentsObject));

      let result;
      try {
        result = await executeTool(functionCall.name, argumentsObject);
        addTrace(trace, "observation", `${functionCall.name} result`, JSON.stringify(result));
      } catch (error) {
        result = { error: error.message };
        addTrace(trace, "error", `${functionCall.name} failed`, error.message);
      }

      input.push({
        type: "function_call_output",
        call_id: functionCall.call_id,
        output: JSON.stringify(result),
      });
    }
  }

  throw new Error("The agent reached the maximum number of steps.");
}
