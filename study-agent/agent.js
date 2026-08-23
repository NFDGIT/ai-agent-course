import OpenAI from "openai";

import { getProvider, selectProviderModel } from "./providers.js";
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

function createClient(provider) {
  if (provider.source === "environment" && !provider.apiKey) return null;
  return new OpenAI({
    apiKey: provider.apiKey || "not-needed",
    baseURL: provider.baseUrl,
  });
}

function addTrace(trace, type, title, detail) {
  trace.push({ type, title, detail });
}

function extractNumber(pattern, text, fallback) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : fallback;
}

function runDemoAgent(message, { provider, model }) {
  const trace = [];
  const hours = extractNumber(/(\d+(?:\.\d+)?)\s*hours?/i, message, 2);
  const sessionMinutes = extractNumber(/(\d+)\s*-?\s*(?:minute|min)/i, message, 25);

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
    provider: provider.alias,
    model,
    answer: `You have ${sessions} complete ${sessionMinutes}-minute sessions.\n\n${plan}`,
    trace,
  };
}

function* splitText(text, chunkSize = 24) {
  for (let index = 0; index < text.length; index += chunkSize) {
    yield text.slice(index, index + chunkSize);
  }
}

function providerError(provider, model, error, streamModel) {
  const responseMode = streamModel ? "streaming /responses API" : "/responses API";
  return new Error(
    `Provider ${provider.alias} could not run model ${model}. It must support the OpenAI-compatible ${responseMode} and function calling. ${error.message}`,
  );
}

export function prepareResponseOutputForInput(output) {
  return output.map((item) => {
    if (item.type === "function_call") {
      const { parsed_arguments: _parsedArguments, ...inputItem } = item;
      return inputItem;
    }

    if (item.type === "message") {
      return {
        ...item,
        content: item.content.map((content) => {
          const { parsed: _parsed, ...inputContent } = content;
          return inputContent;
        }),
      };
    }

    return item;
  });
}

async function* runStudyAgentEvents(
  message,
  { providerAlias = "Default", model: requestedModel, signal, streamModel = false } = {},
) {
  const provider = getProvider(providerAlias);
  const model = selectProviderModel(provider, requestedModel);
  const client = createClient(provider);

  if (!client) {
    const result = runDemoAgent(message, { provider, model });
    yield { type: "agent.started", mode: result.mode, provider: result.provider, model: result.model };
    for (const step of result.trace) yield { type: "trace", step };
    for (const delta of splitText(result.answer)) yield { type: "text.delta", delta };
    yield { type: "done", result };
    return;
  }

  const trace = [];
  const input = [{ role: "user", content: message }];
  yield { type: "agent.started", mode: "openai", provider: provider.alias, model };

  for (let step = 0; step < 6; step += 1) {
    const decision = {
      type: "decision",
      title: `Model turn ${step + 1}`,
      detail: "Ask the model for the next response or action.",
    };
    trace.push(decision);
    yield { type: "trace", step: decision };

    let response;
    try {
      const request = {
        model,
        instructions,
        tools: toolDefinitions,
        input,
      };

      if (streamModel) {
        const responseStream = client.responses.stream(request, { signal });
        for await (const event of responseStream) {
          if (event.type === "response.output_text.delta") {
            yield { type: "text.delta", delta: event.delta };
          }
        }
        response = await responseStream.finalResponse();
      } else {
        response = await client.responses.create(request, { signal });
      }
    } catch (error) {
      throw providerError(provider, model, error, streamModel);
    }

    input.push(...prepareResponseOutputForInput(response.output));
    const functionCalls = response.output.filter((item) => item.type === "function_call");

    if (functionCalls.length === 0) {
      const finalStep = {
        type: "final",
        title: "Final answer",
        detail: "The model finished without requesting another tool.",
      };
      trace.push(finalStep);
      yield { type: "trace", step: finalStep };

      const result = {
        mode: "openai",
        provider: provider.alias,
        model,
        answer: response.output_text,
        trace,
      };
      yield { type: "done", result };
      return;
    }

    for (const functionCall of functionCalls) {
      const argumentsObject = JSON.parse(functionCall.arguments);
      const toolStep = {
        type: "tool",
        title: `Call ${functionCall.name}`,
        detail: JSON.stringify(argumentsObject),
      };
      trace.push(toolStep);
      yield { type: "trace", step: toolStep };

      let result;
      try {
        result = await executeTool(functionCall.name, argumentsObject);
        const observation = {
          type: "observation",
          title: `${functionCall.name} result`,
          detail: JSON.stringify(result),
        };
        trace.push(observation);
        yield { type: "trace", step: observation };
      } catch (error) {
        result = { error: error.message };
        const failure = {
          type: "error",
          title: `${functionCall.name} failed`,
          detail: error.message,
        };
        trace.push(failure);
        yield { type: "trace", step: failure };
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

export async function* streamStudyAgent(message, options = {}) {
  yield* runStudyAgentEvents(message, { ...options, streamModel: true });
}

export async function runStudyAgent(message, options = {}) {
  for await (const event of runStudyAgentEvents(message, options)) {
    if (event.type === "done") return event.result;
  }

  throw new Error("The agent stream ended without a result.");
}
