const memory = {
  learningGoal: null,
};

export const toolDefinitions = [
  {
    type: "function",
    name: "calculate_study_sessions",
    description: "Calculate how many complete focus sessions fit into the available study time.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        hours: {
          type: "number",
          description: "Total hours available for studying.",
        },
        session_minutes: {
          type: "number",
          description: "Length of one focus session in minutes.",
        },
      },
      required: ["hours", "session_minutes"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "save_learning_goal",
    description: "Save the learner's current goal so it can be reused later in the task.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description: "The learner's goal in clear, concise language.",
        },
      },
      required: ["goal"],
      additionalProperties: false,
    },
  },
];

export function calculateStudySessions({ hours, session_minutes: sessionMinutes }) {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("hours must be a positive number");
  }

  if (!Number.isFinite(sessionMinutes) || sessionMinutes <= 0) {
    throw new Error("session_minutes must be a positive number");
  }

  const totalMinutes = Math.round(hours * 60);
  const sessions = Math.floor(totalMinutes / sessionMinutes);
  const unusedMinutes = totalMinutes - sessions * sessionMinutes;

  return {
    total_minutes: totalMinutes,
    sessions,
    session_minutes: sessionMinutes,
    unused_minutes: unusedMinutes,
  };
}

export function saveLearningGoal({ goal }) {
  const normalizedGoal = goal?.trim();
  if (!normalizedGoal) {
    throw new Error("goal must not be empty");
  }

  memory.learningGoal = normalizedGoal;
  return {
    saved: true,
    learning_goal: memory.learningGoal,
  };
}

export function readMemory() {
  return { ...memory };
}

export function resetMemory() {
  memory.learningGoal = null;
}

export async function executeTool(name, argumentsObject) {
  switch (name) {
    case "calculate_study_sessions":
      return calculateStudySessions(argumentsObject);
    case "save_learning_goal":
      return saveLearningGoal(argumentsObject);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
