import "dotenv/config";

import express from "express";

import { runStudyAgent } from "./agent.js";
import { readMemory } from "./tools.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

app.get("/api/status", (_request, response) => {
  response.json({
    ok: true,
    mode: process.env.OPENAI_API_KEY ? "openai" : "demo",
    model: process.env.OPENAI_MODEL || "gpt-5.4",
  });
});

app.get("/api/memory", (_request, response) => {
  response.json(readMemory());
});

app.post("/api/agent", async (request, response) => {
  const message = request.body?.message?.trim();

  if (!message) {
    response.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const result = await runStudyAgent(message);
    response.json(result);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: error.message || "The agent failed" });
  }
});

app.listen(port, () => {
  const mode = process.env.OPENAI_API_KEY ? "OpenAI" : "demo";
  console.log(`Study Agent running at http://localhost:${port} (${mode} mode)`);
});
